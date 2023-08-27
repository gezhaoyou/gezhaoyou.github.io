---
layout: post
title:  "docker compose搭建wordpress博客"
description: ""
author: zhaoyou
date:   2023-08-27 17:43:37 +0800
permalink: 853b3772.html
views:
    - '50'
categories:
    - 代码
tags:
    - 代码

image:
  path: https://io.fifo.site/image-20230827180317803.png
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

本博客使用的是 jekyll 生成的静态博客，之前使用的是 WordPress 搭建的，因为服务器性能太烂，所以弃了 WP，转投静态博客生成程序。

今天记录下docker 搭建 WordPress 的步骤，主要是找起资料来太麻烦，怕以后找不着，自己记录下更好。也没准哪天自己又换回 WordPress😶。

我使用的是 M1 版本的 MPB，也就是 Apple Silicon(arm) 版本的处理器。所以一般的 MySQL 镜像是会报架构错误的。

### 准备

闲言少叙，以下是  M1 版本配置步骤：

找个目录创建 `docker-compose.yml` 文件

```bash
vi docker-compose.yml
```

放入以下内容：

```bash
ersion: '3.8'

services:
  db:
    expose:
      - 3306
    image: arm64v8/mysql
    volumes: 
      - ./db_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_DATABASE: wp_db
      MYSQL_USER: admin
      MYSQL_ROOT_PASSWORD: password
      MYSQL_PASSWORD: 1234
    networks:
      - wp

  phpmyadmin:
    image: phpmyadmin
    restart: always
    ports:
      - 8080:80
    environment:
      - PMA_HOST=db
      - MYSQL_ROOT_PASSWORD=password
      - PMA_ARBITRARY=1
      - UPLOAD_LIMIT=300M
    depends_on:
      - db
    networks:
      - wp

  wordpress:
    ports:
      - "${PORT:-8000}:80"
    depends_on:
      - db
    image: wordpress:latest
    volumes:
      - ./wp-content:/var/www/html/wp-content
    environment:
      WORDPRESS_DB_NAME: wp_db
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: root
      WORDPRESS_DB_PASSWORD: password
      WORDPRESS_TABLE_PREFIX: da_
    networks:
      - wp
networks:
  wp:
volumes:
  db_data:
  wp_data:
```



- 上面脚本安装 `mysql`, `phpadmin`, `wordpress` 镜像
- MySQL 使用的镜像为：`arm64v8/mysql`, 如果是 intel 处理器，则可以把 `arm64v8`去掉。

- 也可以指定`mysql`版本，如：**mysql:5.7**



### 运行

终端切换到`docker-compose.yml`所在目录，执行命令

```bash
docker-compose up --build
```



##  安装

浏览器访问 `localhost:8000`, 可以安装WordPress 了

![image-20230827175713106](https://io.fifo.site/image-20230827175713106.png)

## 参考

[https://digitalapps.com/developing-wordpress-with-docker-on-apple-silicon/](https://digitalapps.com/developing-wordpress-with-docker-on-apple-silicon/)

[https://catalins.tech/how-to-run-wordpress-locally-on-macos-with-docker-compose/](https://catalins.tech/how-to-run-wordpress-locally-on-macos-with-docker-compose/)



## 推荐

最后推荐一下我移植的 WordPress 主题 Molly: [https://github.com/gezhaoyou/wordpress-theme-molly](https://github.com/gezhaoyou/wordpress-theme-molly)

![screenshot](https://io.fifo.site/screenshot.png)





