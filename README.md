# Instagram Proxy API: Instagram's Public Data as an API.

[![Heroku](https://heroku-badge.herokuapp.com/?app=instareproxy&style=flat&root=server_check_hook)](https://igpi.ga/whizzzkid/media/?count=3)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](https://github.com/whizzzkid/instagram-reverse-proxy/pulls)
[![JavaScript Style Guide: Good Parts](https://img.shields.io/badge/code%20style-goodparts-brightgreen.svg?style=flat)](https://github.com/dwyl/goodparts "JavaScript The Good Parts")
[![Code Climate](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/gpa.svg?style=flat)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![Issue Count](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy/badges/issue_count.svg?style=flat)](https://lima.codeclimate.com/github/whizzzkid/instagram-reverse-proxy)
[![Donate ETH](https://img.shields.io/badge/donate-ETH-yellow.svg)](https://www.myetherwallet.com/?to=0xd86218dF9cDDb43BB8c79C050774a6DaA9d84168#send-transaction)
[![Donate AltCoins](https://img.shields.io/badge/donate-AltCoins-yellow.svg)](https://shapeshift.io/shifty.html?destination=0xd86218dF9cDDb43BB8c79C050774a6DaA9d84168&output=ETH&amount=0.01)
[![Donate GitCheese](https://s3.amazonaws.com/gitcheese-ui-master/images/badge.svg)](https://www.gitcheese.com/donate/users/1895906/repos/84609248)


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

## Requests

| Data Type | End Point | Parameters | Sample URL |
|-|-|-|-|
| User Information | /\<username\>/ | \_\_a=1 (advanced enabled) | https://igpi.ga/whizzzkid/?__a=1 |
| User Posts | \<username\>/media/ | callback: \<jsonp\><br>count: \<number_of_posts\><br>cursor: \<next\> | https://igpi.ga/whizzzkid/media?count=3 |
| User Posts<br>(Faster) | /graphql/query/ | callback: \<jsonp\><br>count: \<number_of_posts\><br>cursor: \<next\><br>*user\_id: <user\_id>| https://igpi.ga/graphql/query/?user_id=1606740656&count=3  |
| HashTags | /explore/tags/\<hashtag\>/media/ | callback: \<jsonp\><br>count: \<number_of_posts\><br>cursor: <next> | https://igpi.ga/explore/tags/yyc/media?count=3 |
| HashTags<br>(Convienient) | /graphql/query/ | callback: \<jsonp\><br>count: \<post_count\><br>cursor: \<next\><br>*tag: \<hashtag\>| https://igpi.ga/graphql/query/?tag=yyc&count=3|
|||*: Required||

## Response

Each response (except for advanced parameters looks like):

```
{
  "next": "next page url",
  "posts": [
    {
    },
    ...
  ]
}
```

**There is a lot more info in each posts. Check them out [here](https://igpi.ga/graphql/query/?tag=yyz)**

## Demo

Send a jsonp request to any of the endpoints above to get instagram data. A simple example in jQuery will be:

```
$.ajax({
  url: "https://igpi.ga/explore/tags/yyc/media",
  dataType: "jsonp",
  data: { count: 3 },
  success: function (json){
    for(var i in json.posts) {
      var img = document.createElement("IMG");
      img.src = json.posts[i].display_url;
      document.body.appendChild(img);
    }
  }
});
```

**Live Demo: http://plnkr.co/edit/4oCwpbMm6p9cyJb1UWld?p=preview**

## Authentication

NO AUTH REQUIRED, that's the best part, you can access all of instagram's public data without authentication or registering an app. Private data returns nothing. However private data maybe accessible using instagram's api if the user is logged in.

    # The following returns data *only* if the user is logged in.
    https://www.instagram.com/<private_user>/media/

    # The following will always return nothing for private users.
    https://igpi.ga/<private_user>/media/

## Wiki Articles

* [Supported Request Types](https://github.com/whizzzkid/instagram-proxy-api/wiki/Supported-Requests-Type)
* [Developing your app using the local instance of Instagram Proxy API](https://github.com/whizzzkid/instagram-proxy-api/wiki/Developing-on-Local)
* [Accessing video URLs for video posts](https://github.com/whizzzkid/instagram-proxy-api/wiki/Accessing-Video-URLs-for-video-posts.)
* [Getting location data for Instagram posts](https://github.com/whizzzkid/instagram-proxy-api/wiki/Getting-Post-Location-Data)

## Rate Limits
Since I discovered a lot of crawlers were using this API to scrape data off instagram, I had to rate limit the requests. The prod APIs get penalized by Instagram if there are too many requests from the heroku instance. To make sure not everyone sufferes because of this, I made sure that multiple requests are rate-limited so that not everyone is penalized. However if you are developing your app locally and want to test it which would involve multiple refreshes and lot of fetching from prod then it's a good idea to run the local instance of the API and use the local address for your dev purposes. Change the instance to prod when deploying.

## Fetch Limits

These apply to the service hosted on: https://igpi.ga and https://igapi.ga

* post fetch limits to **25** (Look for FETCH\_COUNT\_LIMIT).
* Also all requests with `Referer: Undefined` will be denied access.

You're free to fork this repo and change flags to disable those limits.

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
