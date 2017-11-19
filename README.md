# Bandcamp Label View
## About
This python script parses bandcamp label pages and generates a page with all available albums rendered in `iframe` previews.

**Note:** This script does not work for all label pages. If the page has some html modifications, then this script will likely flunk out.

## Usage
Simple pass the script a bandcamp label url, for example:

```
python bandcampLabelView.py https://theautomaton.bandcamp.com/
```

The HTML file will be stored to `./` by default with a url name matching either the bandcamp account (i.e. "theautomaton") if the page follows the format `[account name].bandcamp.com` or the middle part of the url for other website (i.e. `"xyz"`, if url is `www.xyz.com`).

### Parameters
First Argument, required: the label URL

`--output`, a filename for the output file (see default above)

`--location`, an output location (default=`./`)