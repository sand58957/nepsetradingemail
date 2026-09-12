package handlers

import (
	"testing"
	"time"
)

// Simulate the real loop: a ticker with a fixed phase, and a publish that takes
// a couple of seconds so last_published_at lands after the tick that caused it.
// This is what produced 31 minute gaps from a 30 minute setting.
func simulate(t *testing.T, cycles int, tickEvery, publishTakes time.Duration, intervalMin int) []time.Duration {
	t.Helper()
	// A publish happened at `start`, produced by a tick publishTakes earlier.
	// That is the phase relationship that causes the bug: every later tick
	// lands publishTakes short of the slot.
	start := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	last := start
	s := &TitleBankSettings{IntervalMinutes: intervalMin, LastPublishedAt: &last}

	var gaps []time.Duration
	prev := last
	tick := start.Add(-publishTakes)
	for done := 0; done < cycles; {
		tick = tick.Add(tickEvery)
		if !isDue(tick, s, tickEvery) {
			continue
		}
		published := tick.Add(publishTakes)
		gaps = append(gaps, published.Sub(prev))
		prev = published
		stamp := published
		s.LastPublishedAt = &stamp
		done++
	}
	return gaps
}

func TestIntervalDoesNotRunLong(t *testing.T) {
	const interval = 30
	gaps := simulate(t, 24, time.Minute, 2*time.Second, interval)
	want := time.Duration(interval) * time.Minute
	for i, g := range gaps {
		if g != want {
			t.Errorf("cycle %d: gap %v, want exactly %v", i+1, g, want)
		}
	}
}

// Whatever the generation time, the schedule must not drift: 48 posts a day at
// a 30 minute interval.
func TestScheduleHoldsForAnyPublishDuration(t *testing.T) {
	for _, takes := range []time.Duration{
		0, 500 * time.Millisecond, 2 * time.Second, 10 * time.Second, 29 * time.Second,
	} {
		gaps := simulate(t, 12, time.Minute, takes, 30)
		var total time.Duration
		for _, g := range gaps {
			total += g
		}
		if want := 12 * 30 * time.Minute; total != want {
			t.Errorf("publish taking %v: 12 cycles spanned %v, want %v", takes, total, want)
		}
	}
}

// The grace must never let a post out materially early.
func TestNeverPublishesMoreThanHalfATickEarly(t *testing.T) {
	last := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	s := &TitleBankSettings{IntervalMinutes: 30, LastPublishedAt: &last}
	earliest := last.Add(30*time.Minute - 30*time.Second)
	for now := last; now.Before(earliest); now = now.Add(time.Second) {
		if isDue(now, s, time.Minute) {
			t.Fatalf("due at %v, which is %v before the slot", now, last.Add(30*time.Minute).Sub(now))
		}
	}
}

func TestStartAtHoldsPublishing(t *testing.T) {
	now := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	future := now.Add(2 * time.Hour)
	if isDue(now, &TitleBankSettings{IntervalMinutes: 30, StartAt: &future}, time.Minute) {
		t.Error("published before start_at")
	}
}

func TestFirstRunIsDueImmediately(t *testing.T) {
	if !isDue(time.Now(), &TitleBankSettings{IntervalMinutes: 30}, time.Minute) {
		t.Error("a bank that has never published should be due")
	}
}
