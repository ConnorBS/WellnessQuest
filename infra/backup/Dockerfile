FROM alpine:3.20

RUN apk add --no-cache postgresql16-client gzip tzdata bash

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Nightly at 02:30 local time
RUN mkdir -p /etc/periodic/daily \
    && printf '#!/bin/sh\n/usr/local/bin/backup.sh\n' > /etc/periodic/daily/wq-backup \
    && chmod +x /etc/periodic/daily/wq-backup

CMD ["sh", "-c", "/usr/local/bin/backup.sh && exec crond -f -d 8"]
