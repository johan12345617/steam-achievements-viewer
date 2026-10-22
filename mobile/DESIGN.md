# Native adaptation

This app extends the existing Steam-inspired dark interface. It does not replace
the web product's identity. Mode: Operate; browsing games and achievements is the
primary task. The first screen offers Steam sign-in, read-only public lookup, and
an explicit sample mode. Authenticated screens use bottom navigation and native
stack transitions. Game and achievement collections use virtualized lists.

## Tokens

NativeWind/Tailwind owns layout, spacing, type, and component surfaces. Tokens live
in tailwind.config.js: dark #171a21, navy #1b2838, panel #213247, accent #66c0f4,
text #c7d5e0, muted #9aafbf, border #34485e, green #a4d007. Native system fonts,
48dp minimum touch targets, safe-area insets, readable text, and accessible control
labels take priority over decorative effects. Icon colors, native navigation theme,
and media-player interop use native component APIs where className cannot apply.

## Behavior

Every data surface supports loading, empty, error/retry, and refresh states.
Sample and preview modes remain visibly identified. Totals sampled from recent
games are labeled as recent-game progress. Hidden locked achievements avoid
spoilers until explicitly revealed. Media actions require a signed-in session.
Server errors explain how to recover; cancellation is not treated as a successful
login. Layout remains scrollable with font scaling and the keyboard visible.
