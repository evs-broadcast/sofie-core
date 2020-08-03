# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:12.16.1
RUN curl "https://install.meteor.com/?release=1.10.2" | sh
COPY meteor /opt/core/meteor
WORKDIR /opt/core/meteor
# Temporary change the NODE_ENV env variable, so that all libraries are installed:
ENV NODE_ENV_TMP $NODE_ENV
ENV NODE_ENV anythingButProduction
# Force meteor to setup the runtime
RUN meteor --version --allow-superuser
RUN meteor npm install
# Restore the NODE_ENV variable:
ENV NODE_ENV $NODE_ENV_TMP
RUN --mount=type=cache,target=/opt/core/meteor/.meteor/local NODE_OPTIONS="--max-old-space-size=4096" METEOR_DEBUG_BUILD=1 meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install

# DEPLOY IMAGE
FROM node:12.16.1-slim
COPY --from=0 /opt/bundle /opt/core
COPY docker-entrypoint.sh /opt
WORKDIR /opt/core/
CMD ["/opt/docker-entrypoint.sh"]
