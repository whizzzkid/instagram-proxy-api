# InstaReProxy

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/whizzzkid/instagram-reverse-proxy/pulls)
[![JavaScript Style Guide: Good Parts](https://img.shields.io/badge/code%20style-goodparts-brightgreen.svg?style=flat)](https://github.com/dwyl/goodparts "JavaScript The Good Parts")
[![Code Climate](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/gpa.svg)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![Issue Count](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/issue_count.svg)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)

This builds over the Instagram's public API to provide more functionality and provides a CORS complaint reverse instagram proxy service. Try Here: [https://igapi.ga/whizzzkid/media/?count=3](https://igapi.ga/whizzzkid/media/?count=3)

**Read Blog Post: [https://nishantarora.in/building-your-image-gallery-using-public-instagram-API.naml](https://nishantarora.in/building-your-image-gallery-using-public-instagram-API.naml)**

## The Problem.

A user's public data on Instagram can be accessed on `https://www.instagram.com/<user>/media/` but there are are a lot of problems with this service.

  1. The Service is not CORS compliant. i.e. You cannot fetch json directly and the services refuses to send you jsonp data.
  1. It does not support limiting the amount of data being sent. At any moment Instagram will send you 20 images, you cannot control this number.
  1. No pagination support. It get's you the first 20 images and leaves you in the dark to figure out what to do next.

## The Solution

As of now, the service is running on [https://igapi.ga/](https://igapi.ga/)(Heroku) I am not aware about limits, it's basically running on free tier. If it hits any limit, I'll have to figure that out. But the intended use is to replace `http://www.instagram.com` with `https://igapi.ga/`.

## Accessing Data

  * Getting Instagrams's data as is. The following will give you access to the same data instagram provides.

    `https://igapi.ga/<user>/media/`

  * Limiting the amount of images to be sent.

    `https://igapi.ga/<user>/media/?count=10`

  * Using jsonp

    `https://igapi.ga/<user>/media/?callback=foo`

  * Using pagination: Each response has url links to the next and previous page, you can use that to traverse through the results.

## Integration

You just need to replace `http://www.instagram.com/` with `https://igapi.ga/` and everything should just work as is.

## Authentication

NO AUTH REQUIRED, that's the best part, you can access all of instagram's public data without authentication or registering an app. Private data returns nothing. However private data maybe accessible using instagram's api if the user is logged in.

    # The following returns data *only* if the user is logged in.
    https://www.instagram.com/<private_user>/media/

    # The following will always return nothing for private users.
    https://igapi.ga/<private_user>/media/

## Running on local

Clone the repo and change to the cloned directory. Run:

    $ npm install
    $ npm run dev

To run prod instance, run:

    $ npm run prod


## Inspiration

The idea came into being after reading some discussion [here](http://stackoverflow.com/a/33783840).

## Issues & Pull Requests

All contributers are welcome, feel free to report issues and send PRs

## License

Source Code: GPLv3

Service hosted on https://igapi.ga or https://instareproxy.herokuapp.com will be free only for personal use (i.e. personal blogs/personal websites/personal portfolios). If any other website intends to use this service for any purpose can send me an email to **me@nishantarora.in** to discuss more about this (Please include your domain, expected traffic and purpose). Failing to do so will lead to disabled access from this service.

## Update Jul 06, 2017: Over 300,000 requests served in last 30 days :)

The logs have gone wild, the sheer number of requests are amazing for this service is running on the free heroku tier. In the last 30 days we have serviced more than 300,000 requests to this API. Check this graph out:

![Imgur](http://i.imgur.com/vAorSPR.png)

At first I was surprized with this number and was inclined towards thinking that someone was trying to scrape instagram using this API. Turns out I was wrong, a really popular asian website is using this service on their website. I am in talks with them to move this traffic to a dedicated separate instance of this service.