#!/bin/sh

# Remplacer les variables dans la configuration Nginx
envsubst '${ApiUrl}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Demarrer Nginx
nginx -g 'daemon off;'

