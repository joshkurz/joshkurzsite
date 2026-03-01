# cmux Browser Command Reference

## Navigation

```bash
cmux browser open <url>                              # Open URL in current workspace browser pane
cmux browser open <url> --workspace <id|ref>         # Open in specific workspace
cmux browser <surface> goto <url>                    # Navigate to URL on existing surface
cmux browser <surface> back                          # Go back
cmux browser <surface> forward                       # Go forward
cmux browser <surface> reload                        # Reload page
```

## Snapshot & Inspection

```bash
cmux browser <surface> snapshot --interactive                         # Full accessibility tree with refs
cmux browser <surface> snapshot --interactive --compact               # Condensed version
cmux browser <surface> snapshot --interactive --compact --max-depth 3 # Limit tree depth

cmux browser <surface> get url                       # Current URL
cmux browser <surface> get title                     # Page title
cmux browser <surface> get text @eN                  # Text content of element
cmux browser <surface> get html @eN                  # innerHTML of element
cmux browser <surface> get value @eN                 # Value of input element
cmux browser <surface> get attr @eN <attr>           # Element attribute
cmux browser <surface> get count <css-selector>      # Count matching elements
cmux browser <surface> get box @eN                   # Bounding box / position

cmux browser <surface> eval '<js-expression>'        # Evaluate JavaScript, returns result
```

## Interaction

```bash
cmux browser <surface> click @eN                     # Click element
cmux browser <surface> dblclick @eN                  # Double-click element
cmux browser <surface> hover @eN                     # Hover over element
cmux browser <surface> focus @eN                     # Focus element

cmux browser <surface> fill @eN "text"               # Clear and fill input
cmux browser <surface> fill @eN ""                   # Clear an input
cmux browser <surface> type @eN "text"               # Type character by character
cmux browser <surface> select @eN "value"            # Select dropdown option
cmux browser <surface> check @eN                     # Check checkbox
cmux browser <surface> uncheck @eN                   # Uncheck checkbox

cmux browser <surface> press Enter                   # Press key (Enter, Tab, Escape, ArrowDown, etc.)
cmux browser <surface> keydown Meta                  # Key down
cmux browser <surface> keyup Meta                    # Key up

cmux browser <surface> scroll --dy 300               # Scroll down 300px
cmux browser <surface> scroll --dy -300              # Scroll up
cmux browser <surface> scroll --dx 100               # Scroll right
cmux browser <surface> scroll --selector "#list" --dy 200  # Scroll within element
```

## Wait Conditions

```bash
cmux browser <surface> wait --selector "#id" --timeout-ms 10000
cmux browser <surface> wait --text "Done" --timeout-ms 10000
cmux browser <surface> wait --url-contains "/dashboard" --timeout-ms 10000
cmux browser <surface> wait --load-state complete --timeout-ms 15000
cmux browser <surface> wait --function "window.loaded === true" --timeout-ms 10000
```

## Diagnostics

```bash
cmux browser <surface> screenshot                    # Capture screenshot
cmux browser <surface> highlight @eN                 # Highlight element visually
cmux browser <surface> console list                  # Show browser console output
cmux browser <surface> console clear
cmux browser <surface> errors list                   # Show JS errors
```

## Session & Storage

```bash
cmux browser <surface> cookies get
cmux browser <surface> cookies set <name> <value>
cmux browser <surface> cookies clear
cmux browser <surface> storage local get <key>
cmux browser <surface> storage local set <key> <value>
cmux browser <surface> storage session get <key>
cmux browser <surface> tab list
cmux browser <surface> tab new <url>
cmux browser <surface> tab switch <index>
cmux browser <surface> tab close
```

## Workspace / Surface Targeting

```bash
cmux identify --json                                 # Get current workspace + surface IDs
cmux list-panes --json                               # List all panes

# Use --workspace to target a specific workspace
cmux browser open <url> --workspace workspace:2
```

## Global Flags

- `--json` — Output in JSON format (recommended for scripting)
- `--workspace <id|ref>` — Target specific workspace
- `--window <id>` — Target specific window
- `--socket <path>` — Custom socket path (default: `/tmp/cmux.sock`)

## Element Reference Lifecycle

Refs like `@e1`, `@e2` are valid only for the **current DOM state**. After any navigation, form submission, or major DOM mutation, re-run `snapshot --interactive` to get fresh refs. Never reuse refs across page loads.
