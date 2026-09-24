package handlers

import (
	"context"
	"fmt"
	mrand "math/rand/v2"
	"net/http"
	"strings"
	"time"

	"github.com/sandeep/nepsetradingemail/backend/internal/services/openwa"
)

// Keeping a linked WhatsApp number linked.
//
// Campaigns send through an unofficial WhatsApp Web client on a linked number.
// WhatsApp unlinks such a device when it decides the sending looks like spam, and
// the gateway then deletes the stored login, so the number has to be scanned in
// again. In September 2026 the main account's number was unlinked twice in
// thirteen hours, each time about a minute after a campaign started on people who
// had never chatted with it, while the one linked number that sends no campaigns
// stayed linked for days. Repeated unlinks are how WhatsApp warns before it bans
// a number outright.
//
// Nothing here makes bulk messages to strangers safe. It stops this system from
// making an unlink worse:
//   - messages go out at an uneven pace instead of a steady six-second beat;
//   - a dropped connection stops the campaign at once, instead of marking every
//     contact after it failed, which kept them out of every later run;
//   - after an unlink, campaigns wait a day before they can start again;
//   - numbers WhatsApp could not resolve are skipped for a while instead of being
//     tried again by every campaign.

// unlinkCooldown is how long campaigns wait after the number was unlinked.
const unlinkCooldown = 24 * time.Hour

// unreachableSkipSQL is how long campaigns leave out a contact whose number
// WhatsApp could not resolve. Not for ever: the number may join WhatsApp later.
const unreachableSkipSQL = "30 days"

// A batch run has no interval of its own, so it waits between these.
const (
	batchGapMin = 30 * time.Second
	batchGapMax = 60 * time.Second
)

// sendGap returns how long to wait before the next campaign message. It is a
// variable so tests can send without waiting.
//
// The wait is random on purpose: a message exactly every few seconds is itself a
// mark of automation. A batch run waits 30 to 60 seconds. A continuous run waits
// its chosen interval plus up to half as long again, so the chosen interval is
// still the shortest gap.
var sendGap = func(intervalSeconds int) time.Duration {
	if intervalSeconds <= 0 {
		return batchGapMin + time.Duration(mrand.Int64N(int64(batchGapMax-batchGapMin)))
	}

	base := time.Duration(intervalSeconds) * time.Second

	return base + time.Duration(mrand.Int64N(int64(base/2)+1))
}

// averageSendGap is what sendGap waits on average, for time estimates.
func averageSendGap(intervalSeconds int) time.Duration {
	if intervalSeconds <= 0 {
		return (batchGapMin + batchGapMax) / 2
	}

	return time.Duration(intervalSeconds) * time.Second * 5 / 4
}

// recipientRejected reports whether a failed send was about this one recipient,
// so carrying on with the next contact makes sense.
//
// The gateway answers 400 for a recipient it cannot address and 422 for a request
// it cannot use. Every other failure says nothing about the contact: a 409 (as
// openwa.ErrNoConnectedSession) is the session not being connected, 401 and 403
// are the API key, 404 is the session, 408 and 429 are timing, a 5xx is the
// gateway or the WhatsApp Web page behind it failing, and an error with no status
// is the gateway being unreachable.
func recipientRejected(err error) bool {
	gwErr, ok := openwa.AsGatewayError(err)

	return ok && (gwErr.Status == http.StatusBadRequest || gwErr.Status == http.StatusUnprocessableEntity)
}

// recipientUnreachable reports whether WhatsApp could not resolve the recipient's
// number. The gateway cannot tell a number that is not on WhatsApp from one that
// WhatsApp will not let a linked device start a first chat with, and neither can
// be sent to.
func recipientUnreachable(err error) bool {
	gwErr, ok := openwa.AsGatewayError(err)

	return ok && gwErr.Status == http.StatusBadRequest &&
		strings.Contains(strings.ToLower(gwErr.Message), "could not resolve the recipient")
}

// campaignsBlockedUntil reports whether a number is still waiting out an unlink,
// and until when.
//
// The hold is for the phone that was unlinked. Once a different phone is linked
// to this number there is nothing to wait out, and holding it anyway told the
// operator that the phone they had just linked "was unlinked". While the
// unlinked phone, or none, is linked — or when which phone it was is not known —
// the hold stands.
func campaignsBlockedUntil(number *WANumber, now time.Time) (time.Time, bool) {
	if number == nil || number.UnlinkedAt == nil {
		return time.Time{}, false
	}

	if number.UnlinkedPhone != "" && number.LinkedPhone != "" && number.LinkedPhone != number.UnlinkedPhone {
		return time.Time{}, false
	}

	until := number.UnlinkedAt.Add(unlinkCooldown)

	return until, now.Before(until)
}

// nepalZone is a fixed zone rather than time.LoadLocation: the container may have
// no tzdata, and Nepal has no daylight saving.
var nepalZone = time.FixedZone("NPT", 5*60*60+45*60)

// nepalClock renders a moment for people in Nepal, e.g. "17 Sep at 9:11 AM Nepal time".
func nepalClock(t time.Time) string {
	return t.In(nepalZone).Format("2 Jan at 3:04 PM") + " Nepal time"
}

// unlinkCooldownMessage explains why a campaign cannot start from a number yet.
func unlinkCooldownMessage(number *WANumber, until time.Time) string {
	what := "This WhatsApp number"
	if number.UnlinkedPhone != "" {
		what = "The WhatsApp number " + number.UnlinkedPhone
	}

	return fmt.Sprintf("%s was unlinked on %s. Numbers that go straight back to sending campaigns after an "+
		"unlink usually get banned, so campaigns from it can start again on %s. Test messages still work, and "+
		"another linked number can send in the meantime.",
		what, nepalClock(*number.UnlinkedAt), nepalClock(until))
}

// Why a campaign paused itself, as shown on the campaign page.
const (
	pauseReasonUnlinked = "WhatsApp unlinked this number while the campaign was sending, which usually means it " +
		"treated the messages as spam. Nobody after that point was messaged. Link the number again on the " +
		"WhatsApp settings page. Campaigns can start again 24 hours after the unlink."

	pauseReasonDropped = "The WhatsApp connection dropped while the campaign was sending. Nobody after that " +
		"point was messaged. Check that the number is still linked on the WhatsApp settings page, then press " +
		"Send to carry on."

	pauseReasonNotConnected = "No WhatsApp number was connected when the campaign tried to send. Link the " +
		"number on the WhatsApp settings page, then press Send."

	pauseReasonRejectedRun = "Many messages in a row were rejected, most often because the numbers are not on " +
		"WhatsApp. Check the contact list before sending more."

	pauseReasonRestarted = "The server restarted in the middle of a batch. Press Send to carry on with the rest."

	pauseReasonTemplate = "This campaign's template could not be read. Check the template, then press Send."
)

// pauseReasonPaced explains a stop by the gateway's daily sending allowance.
func pauseReasonPaced(gatewayReason string, retryAfter time.Duration) string {
	reason := "This number reached its sending allowance for now"
	if gatewayReason != "" {
		reason += " (" + gatewayReason + ")"
	}

	if retryAfter > 0 {
		return reason + ". Sending can carry on in about " + humaniseDuration(retryAfter) + "."
	}

	return reason + "."
}

// How long to follow a session that dropped mid-send, and how often to look.
// Variables so tests do not wait.
var (
	dropWatch = 60 * time.Second
	dropPoll  = 5 * time.Second
)

// sessionDrop is what became of a session that a send found disconnected.
type sessionDrop int

const (
	dropUnresolved sessionDrop = iota // not back when the watch ended
	dropRecovered                     // reconnected with its stored login
	dropUnlinked                      // asking for a QR code: the link is gone
)

// followDroppedSession watches the session of a number that a send found
// disconnected, long enough to tell a brief reconnect from an unlink. After an
// unlink the gateway restarts the engine and shows a QR code within about fifteen
// seconds; after the page behind it crashes it restores the stored login in about
// the same time.
func (h *WhatsAppHandler) followDroppedSession(ctx context.Context, client *openwa.Client,
	number *WANumber) sessionDrop {
	deadline := time.Now().Add(dropWatch)

	for {
		session, err := client.GetSession(ctx, number.OpenWASessionID)
		if err == nil {
			if session.Status == openwa.StatusQRReady {
				// Record which phone it was before rememberNumber clears it.
				h.db.Exec(`UPDATE wa_numbers SET unlinked_at = NOW(),
					unlinked_phone = CASE WHEN linked_phone <> '' THEN linked_phone ELSE unlinked_phone END,
					updated_at = NOW() WHERE id = $1`, number.ID)
				h.rememberNumber(number, session)

				return dropUnlinked
			}

			if session.Connected() {
				return dropRecovered
			}
		}

		if !time.Now().Before(deadline) {
			return dropUnresolved
		}

		time.Sleep(dropPoll)
	}
}
