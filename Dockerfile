# Étape 1 : Build de l'application Angular
FROM node:23.9.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Étape 2 : Serveur Nginx pour servir l'application
FROM nginx:alpine3.21

# Copier les fichiers buildés
COPY --from=build /app/dist /usr/share/nginx/html

# Copier la configuration Nginx comme template
RUN rm -rf /etc/nginx/conf.d/*
COPY default.conf /etc/nginx/templates/default.conf.template
       
# Installer gettext pour envsubst
RUN apk add --no-cache gettext

# Copier et rendre exécutable le script d'entrée
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Définir les variables d'environnement par défaut (optionnel)
ENV ApiUrl=http://localhost:5790

# Utiliser le script d'entrée
ENTRYPOINT ["/entrypoint.sh"]

