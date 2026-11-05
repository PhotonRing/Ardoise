# Relais de synchronisation d'Ardoise
#   docker build -t ardoise-relais relais/
#   docker run -d -p 8787:8787 -v ardoise-relais:/donnees ardoise-relais
FROM node:22-alpine
WORKDIR /app
COPY relais.mjs .
RUN mkdir -p /donnees && chown node:node /donnees
ENV PORT=8787 HOTE=0.0.0.0 DONNEES=/donnees
VOLUME /donnees
EXPOSE 8787
USER node
CMD ["node", "relais.mjs"]
