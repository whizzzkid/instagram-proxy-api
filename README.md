# InstaReProxy

[![Heroku](https://heroku-badge.herokuapp.com/?app=instareproxy&style=flat&root=server_check_hook)](https://igpi.ga/whizzzkid/media/?count=3)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](https://github.com/whizzzkid/instagram-reverse-proxy/pulls)
[![JavaScript Style Guide: Good Parts](https://img.shields.io/badge/code%20style-goodparts-brightgreen.svg?style=flat)](https://github.com/dwyl/goodparts "JavaScript The Good Parts")
[![Code Climate](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/gpa.svg?style=flat)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![Issue Count](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/issue_count.svg?style=flat)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![gitcheese.com](https://s3.amazonaws.com/gitcheese-ui-master/images/badge.svg)](https://www.gitcheese.com/donate/users/1895906/repos/84609248)


This builds over the Instagram's public API to provide more functionality and provides a CORS complaint reverse instagram proxy service. Try Here: [https://igpi.ga/whizzzkid/media/?count=3](https://igpi.ga/whizzzkid/media/?count=3)

**Read Blog Post: [https://nishantarora.in/building-your-image-gallery-using-public-instagram-API.naml](https://nishantarora.in/building-your-image-gallery-using-public-instagram-API.naml)**

## 1-Click Deploy

[![Deploy](https://www.herokucdn.com/deploy/button.svg?style=flat)](https://heroku.com/deploy?template=https://github.com/whizzzkid/instagram-reverse-proxy)

## The Problem.

A user's public data on Instagram can be accessed on `https://www.instagram.com/<user>/media/` but there are are a lot of problems with this service.

  1. The Service is not CORS compliant. i.e. You cannot fetch json directly and the services refuses to send you jsonp data.
  1. It does not support limiting the amount of data being sent. At any moment Instagram will send you 20 images, you cannot control this number.
  1. No pagination support. It get's you the first 20 images and leaves you in the dark to figure out what to do next.

## The Solution

As of now, the service is running on [https://igpi.ga/](https://igpi.ga/)(Heroku) I am not aware about limits, it's basically running on free tier. If it hits any limit, I'll have to figure that out. But the intended use is to replace `http://www.instagram.com` with `https://igpi.ga/` or `https://igapi.ga/`.

## Accessing Data

  * Getting Instagrams's data as is. The following will give you access to the same data instagram provides.

    `https://igpi.ga/<user>/media/` or `https://igapi.ga/<user>/media/`

  * Limiting the amount of images to be sent.

    `https://igpi.ga/<user>/media/?count=10` or `https://igapi.ga/<user>/media/?count=10`

  * Using jsonp

    `https://igpi.ga/<user>/media/?callback=foo` or `https://igapi.ga/<user>/media/?callback=foo`

  * Using pagination: Each response has url links to the next and previous page, you can use that to traverse through the results.

## Integration

You just need to replace `http://www.instagram.com/` with `https://igpi.ga/` or `https://igapi.ga/` and everything should just work as is.

## Authentication

NO AUTH REQUIRED, that's the best part, you can access all of instagram's public data without authentication or registering an app. Private data returns nothing. However private data maybe accessible using instagram's api if the user is logged in.

    # The following returns data *only* if the user is logged in.
    https://www.instagram.com/<private_user>/media/

    # The following will always return nothing for private users.
    https://igpi.ga/<private_user>/media/

## Running on local

Clone the repo and change to the cloned directory. Run:

    $ npm install
    $ npm run dev

To run prod instance, run:

    $ npm run prod


## Inspiration

The idea came into being after reading some discussion [here](http://stackoverflow.com/a/33783840).

## Updates

### Jul 06, 2017: Over 300,000 requests served in last 30 days :)

The logs have gone wild, the sheer number of requests are amazing for this service is running on the free heroku tier. In the last 30 days we have serviced more than 300,000 requests to this API. Check this graph out:

![Imgur](http://i.imgur.com/vAorSPR.png)

At first I was surprized with this number and was inclined towards thinking that someone was trying to scrape instagram using this API. Turns out I was wrong, a really popular asian website is using this service on their website. I am in talks with them to move this traffic to a dedicated separate instance of this service.

### July 11, 2017: Served 440,000+ requests in last 30 days. Heroku suspended my account.

OMFG, this shit just got out of hand:

![Imgur](http://i.imgur.com/pNp7R74.png)

### July 12, 2017: Moved all services to igpi.ga ('a' removed). Blacklist added.

### Oct 26, 2017: Undefined referers will not be served at prod.

Both production urls igapi.ga nd igpi.ga will no longer serve content to `undefined` referers. Your requests will need to explicitly provide referer meta data in the headers. If you're using this service on your website, your browser will automatically handle this, so no change will be required on your part.

### Nov 08, 2017: Media Queries No Longer Working
Instagram seems to have patched the media endpoints and now they resolve to 404-pages, however the advanced params still work as of now. So in short, instead of using [https://igpi.ga/whizzzkid/media/?count=3](https://igpi.ga/whizzzkid/media/?count=3) (which won't work) use [https://igpi.ga/whizzzkid/?\_\_a=1](https://igpi.ga/whizzzkid/media/?__a=1) and get the data from user.media.nodes object. I'll try figuring the solution around to this.

### Nov 10, 2017: Workaround in affect, this is purely experimental.
I am trying to query instagram's GQL servers to rebuild responses. These can be accessed like: https://igpi.ga/graphql/query/?user_id=<user_id>&count=<post_count>. e.g. https://igpi.ga/graphql/query/?user_id=1606740656&count=3

User id can be found here: https://www.instagram.com/whizzzkid/?__a=1 I'll be working on extracting this next.

### Nov 12, 2017: Experimental workround seems effective.
The workaround implemented by hacking the GQL queries seems effective. The proxy has been running smooth, so I proted the old endpoints to utilize this. It's undertstandable that this will take twice as longer. But again, it works!

### Nov 14, 2017: Enabling `undefined` referrers for user testing.
Since, IG disable `/media` urls, undefined referrers will be enabled for a while for perople to test this out.

## Issues & Pull Requests

All contributers are welcome, feel free to report issues and send PRs

## License

Source Code: GPLv3

Service hosted on https://igpi.ga or https://igapi.ga or any heroku instance used in running these services, will be free only for personal use (i.e. personal blogs/personal websites/personal portfolios). If any other entity intends to use this service for any other purpose, please send an email to **me@nishantarora.in** to discuss more about this (Please include your domain, expected traffic and purpose). Failing to do so will lead to [blacklisting from this service](https://github.com/whizzzkid/instagram-proxy-api/blob/master/blacklist.js).
