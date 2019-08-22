docker rm -f pato
docker run --rm -it -p 4000:4000 -v //c/src/patoarchitekci.github.io/:/site --name pato andredumas/github-pages serve --watch --force_polling