#!/usr/bin/env bash

DIR="${0%/*}"

TITLE=`echo $@ | sed 's/[ ][ ]*/-/g'`
SLUG=`openssl rand -hex 8 | md5 | cut -c1-8`

# Get current date, year, and month
TIME=$(date +"%Y-%m-%d %T")
DATE=$(date +"%Y-%m-%d")
YEAR=$(date +"%Y")
MONTH=$(date +"%m")

mkdir -p _posts/$YEAR/$MONTH

cat > ${DIR}/_posts/$YEAR/$MONTH/$DATE-${TITLE}.md << EOF
---
layout: post
title:  "${TITLE}"
author: zhaoyou
date:   ${TIME} +0800
permalink: ${SLUG}.html
categories:
    - 代码
tags:
    - 代码

image:
  path: http://io.fifo.site/thumb-$[RANDOM%11+1].jpg
  alt: ''
  thumb:  
    enable: true
    size: 'small' #small, medium, large

# SEO INFO
description: ""
---

EOF

open ${DIR}/_posts/$YEAR/$MONTH/$DATE-${TITLE}.md
