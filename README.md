# oci-free-pulumi

This is an example of how to use [pulumi](https://www.pulumi.com/) and the free tier of [OCI](https://www.oracle.com/it/cloud/) to create via infrastrucutre as code an instance with:

- 4 cpu
- 24 GB of RAM
- Ubuntu 22.04
- ARM powered instance VM.Standard.A1.Flex
- 100 GB disk space
- volume backup
- backup policy
- public ip

## Requirements

A linux or WSL2 enviroments with:

- Make command installed
- docker and docker-compose

A Pulumi account (I'm using a free one)

A OCI account (I'm using the free tier)

## Getting started

Clone the repository, rename `template.env` in `.env`. Change properly the env variables and use the command `make oci` to build the docker image and start the compose. You will notice that all your localhost configuration such as `~/.ssh` and `~/.oci` directories will mounted into the container context.

So you can store your env and secret locally without shared with the code.

## Limits

I'am using the default root user into the container... If you want to help me, please open a PR.
