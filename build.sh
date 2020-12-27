#!/bin/sh

rm timetracker.zip && zip -r timetracker.zip * --exclude 'README.md' '*.zip' '*.git*' 'build.sh'
