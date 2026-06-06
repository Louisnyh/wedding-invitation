# Louis & Joyce Wedding Invitation

## 1. Project Purpose

This project is a personalized wedding invitation microsite for **Louis & Joyce**.

It is designed as a premium digital wedding experience, not just a basic RSVP page. Guests open a personal link, and the page shows details that are specific to them, such as their name, invitation message, assigned table, and confirmed table members.

The approved visual direction is:

- Soft Glasshouse Garden
- Soft lavender, ivory white, champagne gold, eucalyptus green
- Elegant, warm, emotional, minimal
- Mobile-first, especially for WhatsApp sharing

## 2. File Structure

```text
wedding-invitation/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    └── glasshouse-hero.png
```

- `index.html` contains the page structure.
- `style.css` contains the approved visual design.
- `script.js` contains the guest data and token logic.
- `assets/glasshouse-hero.png` is the hero image.
- `README.md` explains how to use and maintain the project.

## 3. How to Preview Locally

Open Terminal and run:

```bash
cd /Users/mac12/Desktop/wedding-invitation
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open this in your browser:

[http://127.0.0.1:8000/](http://127.0.0.1:8000/)

To stop the local preview server, go back to Terminal and press:

```text
Control + C
```

## 4. How to Test Tokens

Guest data is selected using a `token` in the URL.

Example:

```text
index.html?token=jason-a7k29x
```

Local preview examples:

- [http://127.0.0.1:8000/index.html?token=jason-a7k29x](http://127.0.0.1:8000/index.html?token=jason-a7k29x)
- [http://127.0.0.1:8000/index.html?token=auntmay-l9p31e](http://127.0.0.1:8000/index.html?token=auntmay-l9p31e)

If the token is missing or invalid, the site will show a polite invalid invitation message.

Example invalid links:

- [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html)
- [http://127.0.0.1:8000/index.html?token=wrong-token](http://127.0.0.1:8000/index.html?token=wrong-token)

## 5. How to Commit and Push Using GitHub Desktop

1. Open **GitHub Desktop**.
2. Choose the repository: `wedding-invitation`.
3. Check the changed files list.
4. Write a short summary, for example:

```text
Add README documentation
```

5. Click **Commit to main**.
6. Click **Push origin**.

After pushing, the changes will be uploaded to GitHub.

## 6. GitHub Pages Live URL

Live site URL:

[https://louisnyh.github.io/wedding-invitation/](https://louisnyh.github.io/wedding-invitation/)

Example guest link:

[https://louisnyh.github.io/wedding-invitation/index.html?token=jason-a7k29x](https://louisnyh.github.io/wedding-invitation/index.html?token=jason-a7k29x)

If the live link does not work yet, check that GitHub Pages is enabled in the GitHub repository settings.

## 7. Current Data Approach

Right now, guest data is stored in `sampleData` inside `script.js`.

The data includes:

- Wedding details
- Guest types
- Guests
- Tokens
- Table assignments
- Table stories
- RSVP-related copy

This is useful for prototyping because it works without a database or external service.

## 8. Future Data Approach

Later, the data can come from:

- Google Sheets
- Google Apps Script

Recommended future flow:

1. Store guest rows in Google Sheets.
2. Use Apps Script to publish a simple data endpoint.
3. The website reads the token from the URL.
4. The website requests only the matching guest data.
5. The page renders the same personalized experience.

Do not connect Google Sheets yet. The current version only uses `sampleData`.

## 9. Important Privacy Rule

Do **not** store real guest phone numbers, private guest data, addresses, or sensitive personal details in GitHub.

GitHub repositories can be public or accidentally shared. Keep private guest information in a safer system such as Google Sheets with controlled access.

## 10. Important Design Rule

Do **not** redesign the approved visual direction unless specifically requested.

The current approved direction is:

- Soft Glasshouse Garden
- Premium wedding experience
- Elegant Chinese typography
- Soft lavender primary color
- Ivory white, champagne gold, eucalyptus green
- Minimal, warm, emotional, and personal

