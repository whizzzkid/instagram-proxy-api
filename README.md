# InstaReProxy

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/whizzzkid/instagram-reverse-proxy/pulls)
[![JavaScript Style Guide: Good Parts](https://img.shields.io/badge/code%20style-goodparts-brightgreen.svg?style=flat)](https://github.com/dwyl/goodparts "JavaScript The Good Parts")
[![Code Climate](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/gpa.svg)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![Issue Count](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/issue_count.svg)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)

This builds over the Instagram's public API to provide more functionality and provides a CORS complaint reverse instagram proxy service

## The Problem.

A user's public data on Instagram can be accessed on `https://www.instagram.com/<user>/media/` but there are are a lot of problems with this service.

  1. The Service is not CORS compliant. i.e. You cannot fetch json directly and the services refuses to send you jsonp data.
  1. It does not support limiting the amount of data being sent. At any moment Instagram will send you 20 images, you cannot control this number.
  1. No pagination support. It get's you the first 20 images and leaves you in the dark to figure out what to do next.
  
## The Solution

As of now, the service is running on `https://instareproxy.herokuapp.com/` I am not aware about limits, it's basically running on free tier. If it hits any limit, I'll have to figure that out. But the intended use is to replace `http://www.instagram.com` with `https://instareproxy.herokuapp.com/`.

## Accessing Data

  * Getting Instagrams's data as is. The following will give you access to the same data instagram provides.
    
    `https://instareproxy.herokuapp.com/<user>/media/`

  * Limiting the amount of images to be sent.
    
    `https://instareproxy.herokuapp.com/<user>/media/?count=10`
  
  * Using jsonp
    
    `https://instareproxy.herokuapp.com/<user>/media/?callback=foo`
  
  * Using pagination: Each response has url links to the next and previous page, you can use that to traverse through the results.
  
## Integration

You just need to replace `http://www.instagram.com/` with `https://instareproxy.herokuapp.com/` and everything should just work as is.

## Authentication

NO AUTH required, that's the best part, you can access all of instagram's public data without authentication or registering an app.

## Issues & Pull Requests

All contributers are welcome, feel free to report issues and send PRs

## License

GPLv3
