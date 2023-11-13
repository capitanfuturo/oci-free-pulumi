.DEFAULT_GOAL := help

#.PHONY: code oci 

##help: @ This help
help:
	@fgrep -h "##" $(MAKEFILE_LIST)| sort | fgrep -v fgrep | tr -d '##'  | awk 'BEGIN {FS = ":.*?@ "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

##code: @ Open VS code
code:
	code .

##oci: @ Run oci tool image
oci:
	docker-compose build
	docker-compose run --rm oci
