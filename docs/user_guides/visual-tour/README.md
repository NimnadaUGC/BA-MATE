# BA Mate visual field guide

**65 illustrated pages, 63 original desktop captures, BA-MATE 1.0.0-beta.3, 1 November 2026.** The screenshot-led companion to the three textual application guides. Each screen has numbered callouts, practical actions and an expected-result checkpoint.

- [Read the PDF](BA-Mate-Visual-Guide-v1.0.0-beta.3.pdf) — clickable contents and a bookmark for every page.
- [Open the offline gallery](index.html) — search topics, move between pages and expand the instructions as text. Keep this folder together; the HTML file can be opened locally without a server.
- [Individual illustrated pages](pages/) — reusable PNGs.
- [Original desktop screenshots](screenshots/) — all 1440 x 1000. Callouts are publication overlays; the captures remain unchanged.
- [Starting brief](practice/practice-cash-checkout.txt) and [completed fictional project backup](practice/Practice-Cash-Checkout-completed.zip).

Start with pages 1-3. Pages 4-15 cover connection and setup; 16-32 cover discovery through B1; 33-44 cover the controlled change, B2, completion, export and recovery. Pages 45-61 explain optional tools. Pages 62-65 cover recent work, help, study status and troubleshooting.

## The walkthrough behind the pictures

The source-run **browser edition** was operated through its actual interface in an isolated local data directory. The main Practice Cash Checkout project completed all six stages, a reviewed 500-unit baseline, a controlled change to 300, revalidation and B2. The complete B1 record remained unchanged. A project ZIP was exported and restored as a separate completed project; its original source bytes were checked by SHA-256. Existing analyst projects were outside this isolated workspace.

Early screens were repeated in a separate **setup rehearsal** for desktop-size captures. That project also demonstrates optional stories, registers, API impact, document sections and finding controls. It intentionally contains draft work and an open practice warning. It is not the completed main project. Generated record IDs differ between some illustrations.

Real OpenRouter / `google/gemini-2.5-flash-lite` calls exercised the requirement replay, process diagram, quality review, saved conversation, hypothetical impact assessment and document-section proposal. All six fixed synthetic qualification tasks returned valid structured proposals; human qualification approval was not recorded. An initial local `qwen2.5:3b` request also generated a requirement. The optional `qwen3:8b` screen is a setup illustration. The supplied session key was removed after these examples; no credential is part of the guide or backup.

Study participation accurately shows **not connected**. Connected sign-in, formal submission and participant evaluation were not demonstrated. Familiarisation is not study enrolment. All stakeholder confirmations and approvers shown are explicitly simulated. This guide does not establish framework validity, model equivalence, clean-device installation or native distribution qualification.

## Practise safely

For a fresh exercise, create a separate project and import the starting text. Its missing limit is intentional: record the simulated 500-unit confirmation separately, then follow the 300-unit change. To inspect the finished example, use Settings → Restore project backup with the supplied ZIP. Restoration adds a separate project; check its name and source availability before working in it. The native backup format embeds the source original inside its project JSON.

During a formal study, follow the researcher's assigned task, condition and stopping point. Use your own authorized provider configuration. The included project is a training example, not participant evidence or a ready-to-implement checkout specification.

## Edit or rebuild

`source/tour.json` is the canonical editable content and annotation source. `source/build_visual_guide.py` creates the PDF and offline gallery with ReportLab and Pillow. Google Sans Flex fonts and their licence are bundled in `assets/fonts`.

From this folder:

```sh
python3 source/build_visual_guide.py
mkdir -p pages
pdftoppm -scale-to 1600 -png BA-Mate-Visual-Guide-v1.0.0-beta.3.pdf pages/page
```

After changing page order, update contents ranges and forward-link destinations in `tour.json`. Remove obsolete rendered images if reducing the page count. Inspect every new page for clipping, readability, annotation placement and consistency with the app. The format is optimized for on-screen reading; use PDF zoom for detail.

See [coverage and verification](source/verification.md), [execution checks](source/execution-verification.json) and [original capture hashes](source/screenshot-manifest.json).
