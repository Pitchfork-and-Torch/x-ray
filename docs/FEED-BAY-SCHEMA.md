# Feed Bay schema

X-Ray 4.0 reads posts on this device. The host does not fetch X, Twitter, or any social API.

A feed is a JSON array of cards, NDJSON (one card per line), a markdown list, or an X archive `tweets.js` / `tweets.json` file you already have.

Example card (`public/feed-schema.json`):

```json
{
  "name": "Display name",
  "handle": "@handle",
  "body": "text",
  "likes": 0,
  "reposts": 0,
  "insight": "",
  "az": 0,
  "el": 0,
  "plane": "mid",
  "theme": "default"
}
```

Rules:

- HTML tags are stripped. A pasted HTML document is rejected.
- A paste that is only an `http` or `https` URL is rejected. Nothing is fetched.
- Pastes over 400 KB are rejected.
- At most 80 cards are kept.
- Archive files shaped like `window.YTD.tweets.part0 = [ ... ]` are parsed locally. `tweet.full_text` becomes `body`.
- Markdown lines look like `- @handle: text`.
- Export downloads JSON. The host does not receive the file.
- Vectors still only stamp handle labels onto the active feed.

`plane` is `near`, `mid`, or `far`. `az` and `el` are degrees, same fields as Demo Reality.
