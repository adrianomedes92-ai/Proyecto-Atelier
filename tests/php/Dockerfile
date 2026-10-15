FROM php:8.2-cli-bookworm
RUN rm -f /etc/apt/preferences.d/no-debian-php && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends php8.2-cli php8.2-mysql php8.2-gd php8.2-imagick \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/usr/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/sbin:/bin"
WORKDIR /app
