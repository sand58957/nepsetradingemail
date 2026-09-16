# Security headers, included wherever headers are set.
#
# nginx drops every inherited add_header in a block that sets one of its own, so
# a location that adds even a Cache-Control header loses all of these. Keeping
# them in one file and including it in each such block stops them drifting apart.
# The .inc extension keeps conf.d/*.conf from loading this at http level.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
# Content-Security-Policy in report-only first so AdSense/MUI inline styles are
# observed (not broken). Review violation reports, then switch to enforcing
# (Content-Security-Policy) once clean.
add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src https://googleads.g.doubleclick.net https://*.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';" always;
