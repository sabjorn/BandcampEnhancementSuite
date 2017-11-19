#!/usr/bin/env python

import argparse
import urllib2

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Input Data')
    parser.add_argument('url', type=str,
                   help='The bandcamp URL for processing.')
    parser.add_argument('--outfile', type=str,
                   help='output HTML file name')
    parser.add_argument('--location', type=str, default="./",
                   help='output HTML location')


    args = parser.parse_args()

    ## Format url
    # strip trailing '/'
    args.url = args.url.rstrip('/')
    print(args.url)

    ## Get HTML
    response = urllib2.urlopen(args.url)
    html = response.read()

    ## Split into header and body
    # end of header
    header_start = '<ol class="editable-grid music-grid columns-4   public"'

    indices = [i for i, s in enumerate(html.splitlines()) if header_start in s]
    header = html.splitlines()[:indices[0]]
    body = html.splitlines()[indices[0] + 1:] # strip header

    ## Pull necessary data
    albums = []
    hrefs = []
    album_names = []
    artist_names = []

    albums_start = "album-"
    albums = [s.rsplit(albums_start)[-1].strip('"') for i, s in enumerate(body) if albums_start in s]
    hrefs_start = "/album/"
    hrefs = [s.rsplit(hrefs_start)[-1].rstrip("\">'") for i, s in enumerate(body) if hrefs_start in s]

    ## Construct new page data
    div = '<div style="margin: 0px 0px 5px 0px">'
    undiv = '</div>'
    iframe = '<iframe style="border: 10px; width: 400px; height: 472px;" src="http://bandcamp.com/EmbeddedPlayer/album=%s/size=large/bgcol=ffffff/linkcol=0687f5/artwork=small/transparent=true/" seamless><a href="%s"> by </a></iframe>'
    section = div + iframe + div

    section = [section % (a, b) for (a, b) in zip(albums, hrefs)]
    new_body = "".join(section)

    output_html = "".join(header)
    output_html = "".join([output_html, new_body])

    if args.outfile is not None:
        outfile = args.outfile
    else:
        url_val = args.url.split("//")[-1].split(".")
        if url_val[1] == "bandcamp":
            outfile = url_val[0]
        else:
            outfile = url_val[1]

    html_file = open("{0}{1}.html".format(args.location, outfile), "w")
    html_file.write(output_html)
    html_file.close()