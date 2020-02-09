#!/bin/bash
docker rm -f pato
docker run --rm -it -p 4000:4000 -v $(PWD):/site --name pato andredumas/github-pages serve --watch --force_polling