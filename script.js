const PLATFORM = "Hypnotube";

var config = {};
var settings = {};
//Source Methods
source.enable = function (conf, sett, savedState) {
  config = conf ?? {};
  settings = sett ?? {};
};

source.setSettings = function(newsettings) {
	settings = newsettings;
}


source.getHome = function () {
  return new FeedPager(`https://de.xvideos.com/new`);
};

source.searchSuggestions = function (query) {
  return [];
};
source.getSearchCapabilities = () => {
  return {
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: [],
  };
};
source.search = function (query, type, order, filters) {
  return new FeedPager("https://de.xvideos.com/?k="+query.replaceAll(" ","+"));
};
//Video
source.isContentDetailsUrl = function (url) {
  return url.includes("xvideos.com") && (url.replace("xvideos.com","").includes("video"));
};
source.getContentDetails = function (url) {
  return new HVideo(url);
};

class HVideo extends PlatformVideoDetails {
  constructor(url) {
    let res = http.GET(url, {}, false);
    if (!res.isOk) {
      throw new ScriptException("Error trying to load '" + geturl + "'");
    }
    let dom = domParser.parseFromString(res.body);
    let vid=JSON.parse(dom.querySelector("script[type='application/ld+json']").text);
    super({
      id: new PlatformID(PLATFORM, url, config.id),
      name: vid.name,
      thumbnails: new Thumbnails(vid.thumbnailUrl.map((a)=>new Thumbnail(a, 720),)),
      // author:
      //   user != undefined
      //     ? new PlatformAuthorLink(
      //       new PlatformID(PLATFORM, user.getAttribute("href"), config.id), //obj.channel.name, config.id),
      //       user.querySelector(".name").text, //obj.channel.displayName,
      //       user.getAttribute("href"), //obj.channel.url,
      //       "",//
      //       ""
      //     )
      //     : undefined,
      // datetime: Math.round((new Date(ldJson.uploadDate)).getTime() / 1000),
      // duration: flashvars.video_duration,
      // viewCount: views,
      url: url,
      isLive: false,
      description: vid.description,//dom.querySelector('meta[name="description"]').text
      video: new VideoSourceDescriptor([
        new VideoUrlSource({
          container: "video/mp4",
          name: "mp4",
          width: 1920,
          height: 1080,
          url: vid.contentUrl,
        }),
      ]),
    });
    let recs=res.body.split("video_related=")[1].split("}];")[0]+"}]";
    this.recvids = JSON.parse(recs).map((a)=>{
      let duration = -1;
      try {
        let time = a.d;
        let timenum=parseInt(time.replace("min","").replace("mins",""));
        duration = timenum * 60;
      } catch (e) { }
      return new PlatformVideo({
        id: new PlatformID(
          "XVideos",
          "https://xvideos.com"+a.u,
          config.id
        ),
        name: a.tf,
        thumbnails: new Thumbnails([
          new Thumbnail(a.ip, 720),
        ]),
        //   author: new PlatformAuthorLink(
        //     new PlatformID("SomePlatformName", "SomeAuthorID", config.id),
        //     "SomeAuthorName",
        //     "https://platform.com/your/channel/url",
        //     "../url/to/thumbnail.png"
        //   ),
        //   uploadDate: 1696880568,
        duration: duration,
        //viewCount: parseInt(item.querySelector(".sub-desc").text),
        url: "https://xvideos.com"+a.u,
        isLive: false,
    });});
  }

  getContentRecommendations() {
    return new ContentPager(this.recvids, false);
  }
}
source.getContentRecommendations = (url, initialData) => {
  throw new ScriptException("getContentRecommendations");
};

//Comments
source.getComments = function (url) {
  return new CommentPager(
    [
    ],
    false
  );
};
source.getSubComments = function (comment) {
  throw new ScriptException("This is a sample");
};

class FeedPager extends ContentPager {
  constructor(url) {
    super([], true);
    this.url = url;
    this.page = 0;
    this.nextPage();
  }
  nextPage() {
    this.page++;
    const geturl = this.url + "/" + this.page;
    log("Geturlv: " + geturl + " Cookie: " + this.cookie);
    let res = undefined;
    res = http.GET(geturl, {}, false);

    if (!res.isOk) {
      throw new ScriptException("Error trying to load '" + geturl + "'");
    }
    if (res.body.includes("Sorry but the page you requested was not found.")) {
      this.hasMore = false;
      this.results = [];
      return this;
    }
    
    let dom = domParser.parseFromString(res.body);
    let inner = dom.querySelector(".cust-nb-cols");
    if (inner == undefined) {
      throw new ScriptException(
        "Error parsing html trying to load '" + geturl + "'"
      );
    }
    this.results = getVideos(inner.querySelectorAll("div.thumb-block"));
    if (this.results.length == 0) {
      this.hasMore = false;
    }
    log("Got " + this.results.length + " results");
    return this;
  }
}

function getVideos(items) {
  const videos = [];
  for (let item of items) {
    let titlehref = item.querySelector(".title > a");
    let img = item.querySelector("img");
    log("Getting video: " + titlehref.getAttribute("title"));
    log("Image: " + img.getAttribute("src"));
    if (img == undefined) continue;
    let duration = -1;
    try {
      let time = item.querySelector(".duration").text;
      let timenum=parseInt(time.replace("min","").replace("mins",""));
      duration = timenum * 60;
    } catch (e) { }
    videos.push(
      new PlatformVideo({
        id: new PlatformID(
          "XVideos",
          "https://xvideos.com"+titlehref.getAttribute("href"),
          config.id
        ),
        name: titlehref.getAttribute("title"),
        thumbnails: new Thumbnails([
          new Thumbnail(img.getAttribute("data-src"), 720),
        ]),
        //   author: new PlatformAuthorLink(
        //     new PlatformID("SomePlatformName", "SomeAuthorID", config.id),
        //     "SomeAuthorName",
        //     "https://platform.com/your/channel/url",
        //     "../url/to/thumbnail.png"
        //   ),
        //   uploadDate: 1696880568,
        duration: duration,
        //viewCount: parseInt(item.querySelector(".sub-desc").text),
        url: "https://xvideos.com"+titlehref.getAttribute("href"),
        isLive: false,
      })
    );
  }
  return videos;
}

log("LOADED");
