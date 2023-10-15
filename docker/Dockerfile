FROM node:16

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && apt-get -y install --no-install-recommends \ 
    ca-certificates \
    bash-completion \
    curl \
    make && \
    apt-get clean

RUN curl -fsSL https://get.pulumi.com | sh
RUN mkdir /usr/bin/.pulumi && mv /root/.pulumi/* /usr/bin/.pulumi/ 
ENV PATH "$PATH:/usr/bin/.pulumi/bin/"

ARG USER_OCID
ARG FINGERPRINT
ARG TENANCY_OCID
ARG PRIVATE_KEY_PATH
ARG REGION
ARG PULUMI_ACCESS_TOKEN

ENV USER_OCID USER_OCID
ENV FINGERPRINT FINGERPRINT
ENV TENANCY_OCID TENANCY_OCID
ENV PRIVATE_KEY_PATH PRIVATE_KEY_PATH
ENV REGION REGION
ENV PULUMI_ACCESS_TOKEN PULUMI_ACCESS_TOKEN

COPY ./scripts/ /scripts
RUN chmod +x /scripts/*

WORKDIR /code
ENTRYPOINT /scripts/oci.entrypoint.sh