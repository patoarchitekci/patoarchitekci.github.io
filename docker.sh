#!/bin/bash
docker rm -f pato
docker run --rm -it -p 4000:4000 -v $(PWD):/srv/jekyll --name pato jekyll/jekyll:3.8.5 jekyll serve --drafts --watch --force_polling