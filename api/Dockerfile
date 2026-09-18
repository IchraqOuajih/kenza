FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./api/
RUN cd api && npm install
COPY api ./api
COPY data ./data
EXPOSE 3000
CMD ["./api/node_modules/.bin/tsx", "api/src/server.ts"]
