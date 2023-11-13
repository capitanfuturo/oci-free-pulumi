#!/bin/bash

ansible-playbook playbook.yml -i inventory.ini --private-key ${INSTANCE_PRIVATE_KEY_NAME}