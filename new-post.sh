#!/usr/bin/env bash

DIR="${0%/*}"

title=`echo $@ | sed 's/[ ][ ]*/-/g'`
post_date=`date  +"%Y-%m-%d %T"`
post_name="`date "+%Y-%m-%d"`-${title}.markdown"
random_addr=`openssl rand -hex 8 | md5 | cut -c1-8`

cat > ${DIR}/_posts/${post_name} << EOF
---
layout: post
title:  "${title}"
description: ""
author: zhaoyou
date:   ${post_date} +0800
permalink: ${random_addr}.html
views:
    - '50'
categories:
    - 代码
tags:
    - 代码

image:
  path: http://io.fifo.site/thumb-$[RANDOM%11+1].jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

EOF

open ${DIR}/_posts/${post_name}
