#!/bin/bash

ansible-playbook playbook.yml -i inventory.ini --private-key ~/.ssh/${INSTANCE_PRIVATE_KEY_NAME}