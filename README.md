# JS Dev Kit for FileMaker Developers

*Develop, Render, and Deploy JavaScript for a FileMaker App*

# This Kit
## What it does
This environment allows a FileMaker developer to start coding their widget and see the results right away in a FileMaker file. Once done developing, the can be inlined and pushed to the FileMaker file for use offline.
<br/>
It's a template file, so you can use to start other projects.
## Consists of
- A repository template on Github
- A basic html / JS set up.
- package.json file for install
- A FileMaker file to show the widget rendered
- Scripts to build and upload the inlined code to FileMaker
## TO GET STARTED Using this file
1. `npm install`
2. `npm start`
3. Open the jsDev.fmp12 file.
4. Allow it to work in Dev mode.

At this point you should see the web viewer on the layout load up with the HTML and JavaScript here. Edit the JavaScript or the HTML and you'll see the render in the web viewer update.

## Use this kit
Now you're ready to use this kit to create awesome JS widgets.

## HTML to PDF API for FileMaker

This widget exposes a global function in the web viewer:

- `convertHtmlToPdfForFileMaker(htmlOrObject, returnScriptName?)`

You can call it from FileMaker using **Perform JavaScript in Web Viewer**.

### Input options

You can pass either:

1. A raw HTML string
2. A JSON object with optional settings:

```json
{
	"html": "<html><body><h1>Hello</h1></body></html>",
	"requestId": "abc-123",
	"filename": "invoice.pdf",
	"returnScriptName": "OnHtmlToPdfResult",
	"options": {
		"format": "letter",
		"orientation": "portrait",
		"margin": 0
	}
}
```

If no script name is provided, it defaults to `OnHtmlToPdfResult`.

### Result sent back to FileMaker

The widget calls `FileMaker.PerformScript(returnScriptName, JSONPayload)`.

Success payload:

```json
{
	"ok": true,
	"requestId": "abc-123",
	"filename": "invoice.pdf",
	"base64": "JVBERi0xLjQK...",
	"mimeType": "application/pdf"
}
```

Error payload:

```json
{
	"ok": false,
	"requestId": "abc-123",
	"error": "Missing HTML string parameter."
}
```

In your FileMaker callback script, parse JSON from `Get ( ScriptParameter )` and store `base64` in a field, variable, or container workflow.
