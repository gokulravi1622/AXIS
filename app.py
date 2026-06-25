"""AXIS — Centralized Knowledge Assistant"""

import os
from dotenv import load_dotenv
load_dotenv('/Users/gokulravi/Desktop/AXIS/.env')

import streamlit as st
from query import ask, TEAM_ICONS
from contribute import submit_context, get_doc_count
from sync import sync_all

st.set_page_config(
    page_title="AXIS",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={},
)

# ── Session state ──────────────────────────────────────────────────────────────
for k, v in [("messages",[]),("history",[]),("team_filter",None),("sync_log",[]),("theme","dark")]:
    if k not in st.session_state:
        st.session_state[k] = v

is_dark = st.session_state.theme == "dark"

# ── Theme tokens ───────────────────────────────────────────────────────────────
if is_dark:
    BG          = "#09090B"
    SURFACE     = "#111115"
    SURFACE2    = "#18181C"
    BORDER      = "#27272A"
    BORDER2     = "#3F3F46"
    TEXT1       = "#FAFAFA"
    TEXT2       = "#A1A1AA"
    TEXT3       = "#52525B"
    USER_BG     = "#1C1C23"
    USER_BORDER = "#2D2D3A"
    INPUT_BG    = "#111115"
    TAG_BG      = "#18181C"
else:
    BG          = "#F4F4F5"
    SURFACE     = "#FFFFFF"
    SURFACE2    = "#F4F4F5"
    BORDER      = "#E4E4E7"
    BORDER2     = "#D4D4D8"
    TEXT1       = "#09090B"
    TEXT2       = "#52525B"
    TEXT3       = "#A1A1AA"
    USER_BG     = "#EEF2FF"
    USER_BORDER = "#C7D2FE"
    INPUT_BG    = "#FFFFFF"
    TAG_BG      = "#F4F4F5"

ACCENT      = "#6366F1"
ACCENT_H    = "#4F46E5"
ACCENT_DIM  = "rgba(99,102,241,0.12)"
ACCENT_TEXT = "#818CF8" if is_dark else "#4F46E5"

TEAM_COLORS = {
    None:             "#6366F1",
    "Engineering":    "#F59E0B",
    "Data":           "#3B82F6",
    "CRM":            "#8B5CF6",
    "Client Success": "#10B981",
    "Product":        "#EC4899",
}

st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Override Streamlit CSS vars (fixes BaseWeb component backgrounds) ── */
:root {{
    --background-color: {BG} !important;
    --secondary-background-color: {SURFACE2} !important;
    --text-color: {TEXT1} !important;
    --font: 'Inter', -apple-system, sans-serif !important;
}}

*, *::before, *::after {{ box-sizing: border-box; }}
html, body, [class*="css"] {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
}}

.stApp {{ background: {BG} !important; }}
.block-container {{ padding: 0 !important; max-width: 100% !important; }}
#MainMenu, footer, header {{ visibility: hidden !important; }}

::-webkit-scrollbar {{ width: 4px; height: 4px; }}
::-webkit-scrollbar-track {{ background: transparent; }}
::-webkit-scrollbar-thumb {{ background: {BORDER2}; border-radius: 99px; }}

/* ── Sidebar force-open ── */
[data-testid="stSidebarCollapseButton"],
[data-testid="collapsedControl"],
button[kind="header"] {{ display: none !important; }}
[data-testid="stSidebar"][aria-expanded="false"] {{
    display: block !important;
    visibility: visible !important;
    width: 272px !important;
    min-width: 272px !important;
    transform: none !important;
    left: 0 !important;
}}
[data-testid="stSidebar"] {{
    background: {SURFACE} !important;
    border-right: 1px solid {BORDER} !important;
    min-width: 272px !important;
    max-width: 272px !important;
    display: block !important;
    visibility: visible !important;
}}
[data-testid="stSidebar"] > div:first-child {{ padding: 0 !important; margin-top: 0 !important; }}
[data-testid="stSidebar"] > div > div:first-child {{ padding-top: 0 !important; margin-top: 0 !important; }}
[data-testid="stSidebarContent"] {{ padding-top: 0 !important; }}
section[data-testid="stSidebar"] > div {{ padding-top: 0 !important; top: 0 !important; }}

[data-testid="stSidebar"] label {{
    color: {TEXT3} !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.7px !important;
}}

/* ── Sidebar nav buttons ── */
[data-testid="stSidebar"] .stButton > button {{
    background: transparent !important;
    border: 1px solid transparent !important;
    border-radius: 8px !important;
    color: {TEXT2} !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    padding: 8px 12px !important;
    text-align: left !important;
    width: 100% !important;
    justify-content: flex-start !important;
    box-shadow: none !important;
    letter-spacing: 0 !important;
    transition: all 0.15s ease !important;
}}
[data-testid="stSidebar"] .stButton > button:hover {{
    background: {SURFACE2} !important;
    border-color: {BORDER} !important;
    color: {TEXT1} !important;
}}

/* ── Sidebar form ── */
[data-testid="stSidebar"] .stSelectbox > div > div,
[data-testid="stSidebar"] .stTextInput > div > div > input,
[data-testid="stSidebar"] .stTextArea > div > div > textarea {{
    background: {SURFACE2} !important;
    border: 1px solid {BORDER} !important;
    border-radius: 6px !important;
    color: {TEXT2} !important;
    font-size: 12px !important;
}}
[data-testid="stSidebar"] .stTextInput > div > div > input:focus,
[data-testid="stSidebar"] .stTextArea > div > div > textarea:focus {{
    border-color: {ACCENT} !important;
    box-shadow: 0 0 0 3px {ACCENT_DIM} !important;
}}
[data-testid="stSidebar"] .stFormSubmitButton > button {{
    background: {ACCENT} !important;
    color: #fff !important;
    border: none !important;
    border-radius: 8px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    width: 100% !important;
    box-shadow: none !important;
    padding: 9px !important;
    transition: all 0.15s ease !important;
}}
[data-testid="stSidebar"] .stFormSubmitButton > button:hover {{
    background: {ACCENT_H} !important;
    box-shadow: 0 4px 12px {ACCENT_DIM} !important;
}}

/* ── Main text input (target via main block container, not wrapper div) ── */
[data-testid="stMainBlockContainer"] [data-baseweb="input"],
[data-testid="stMainBlockContainer"] [data-baseweb="input"] > div,
[data-testid="stMainBlockContainer"] [data-baseweb="base-input"] {{
    background: {INPUT_BG} !important;
    border: none !important;
    box-shadow: none !important;
}}
[data-testid="stMainBlockContainer"] .stTextInput > div > div > input {{
    background: {INPUT_BG} !important;
    border: 1.5px solid {BORDER} !important;
    border-radius: 12px !important;
    color: {TEXT1} !important;
    font-size: 14px !important;
    font-family: 'Inter', sans-serif !important;
    padding: 0 18px !important;
    height: 48px !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
}}
[data-testid="stMainBlockContainer"] .stTextInput > div > div > input:focus {{
    border-color: {ACCENT} !important;
    box-shadow: 0 0 0 3px {ACCENT_DIM} !important;
}}
[data-testid="stMainBlockContainer"] .stTextInput > div > div > input::placeholder {{
    color: {TEXT3} !important;
}}

/* ── Send button ── */
.send-btn .stButton > button {{
    background: {ACCENT} !important;
    color: #fff !important;
    border: none !important;
    border-radius: 12px !important;
    font-size: 20px !important;
    font-weight: 300 !important;
    width: 48px !important;
    min-width: 48px !important;
    height: 48px !important;
    padding: 0 !important;
    box-shadow: none !important;
    white-space: nowrap !important;
    transition: all 0.15s ease !important;
    line-height: 1 !important;
}}
.send-btn .stButton > button:hover {{
    background: {ACCENT_H} !important;
    box-shadow: 0 4px 16px {ACCENT_DIM} !important;
    transform: translateY(-1px) !important;
}}

/* ── Input row alignment ── */
.input-row [data-testid="stHorizontalBlock"] {{
    align-items: flex-end !important;
    gap: 10px !important;
    background: {BG} !important;
    padding: 0 16px 0 8px !important;
}}
.input-row [data-testid="column"] {{
    padding-left: 0 !important;
    padding-right: 0 !important;
    background: {BG} !important;
}}
.input-row {{ background: {BG} !important; }}

/* ── Theme toggle ── */
.theme-btn .stButton > button {{
    background: {SURFACE2} !important;
    border: 1px solid {BORDER} !important;
    border-radius: 8px !important;
    color: {TEXT2} !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    padding: 6px 14px !important;
    box-shadow: none !important;
    white-space: nowrap !important;
    transition: all 0.15s ease !important;
}}
.theme-btn .stButton > button:hover {{
    border-color: {BORDER2} !important;
    color: {TEXT1} !important;
}}

/* ── Clear button ── */
.clear-btn .stButton > button {{
    background: transparent !important;
    border: 1px solid {BORDER} !important;
    border-radius: 8px !important;
    color: {TEXT3} !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    padding: 7px 14px !important;
    width: 100% !important;
    box-shadow: none !important;
    transition: all 0.15s ease !important;
}}
.clear-btn .stButton > button:hover {{
    border-color: #EF4444 !important;
    color: #EF4444 !important;
    background: rgba(239,68,68,0.06) !important;
}}

/* ── Expander ── */
[data-testid="stExpander"] {{
    background: {SURFACE2} !important;
    border: 1px solid {BORDER} !important;
    border-radius: 8px !important;
    font-size: 12px !important;
}}
[data-testid="stExpander"] summary {{ color: {TEXT2} !important; font-size: 12px !important; }}

/* ── Main block containers ── */
[data-testid="stMainBlockContainer"] {{
    background: {BG} !important;
}}

/* ── Spinner ── */
.stSpinner > div {{ border-top-color: {ACCENT} !important; }}

/* ── Success/Error in sidebar ── */
[data-testid="stSidebar"] [data-testid="stNotification"] {{
    font-size: 12px !important;
    border-radius: 6px !important;
}}
</style>

<script>
(function() {{
    function fix() {{
        const s = document.querySelector('[data-testid="stSidebar"]');
        if (s) {{
            s.setAttribute('aria-expanded','true');
            Object.assign(s.style, {{
                display:'block', visibility:'visible',
                width:'272px', minWidth:'272px', transform:'none', left:'0'
            }});
        }}
        document.querySelectorAll('[data-testid="stSidebarCollapseButton"],[data-testid="collapsedControl"],button[kind="header"]')
            .forEach(el => el.style.display = 'none');
    }}
    // Fix input bg: override Streamlit's BaseWeb/emotion CSS
    function fixInputBg() {{
        const inputBg = '{INPUT_BG}';
        const bg      = '{BG}';
        const text1   = '{TEXT1}';
        const surface2= '{SURFACE2}';
        // Override Streamlit CSS custom properties
        document.documentElement.style.setProperty('--background-color', bg);
        document.documentElement.style.setProperty('--secondary-background-color', surface2);
        document.documentElement.style.setProperty('--text-color', text1);
        // Fix BaseWeb input wrappers in main content (not sidebar)
        const main = document.querySelector('[data-testid="stMainBlockContainer"]');
        if (main) {{
            main.querySelectorAll('[data-baseweb="input"], [data-baseweb="input"] > div, [data-baseweb="base-input"]').forEach(el => {{
                el.style.setProperty('background', inputBg, 'important');
                el.style.setProperty('border', 'none', 'important');
                el.style.setProperty('box-shadow', 'none', 'important');
            }});
            // Restore proper styling on the actual input element
            const inp = main.querySelector('input[placeholder]');
            if (inp) {{
                inp.style.setProperty('background', inputBg, 'important');
                inp.style.setProperty('color', text1, 'important');
            }}
        }}
        // Fix input row column backgrounds
        document.querySelectorAll('.input-row [data-testid="column"]').forEach(el => {{
            el.style.setProperty('background', bg, 'important');
        }});
    }}
    fix();
    fixInputBg();
    setInterval(() => {{ fix(); fixInputBg(); }}, 400);
    new MutationObserver(() => {{ fix(); fixInputBg(); }}).observe(document.body, {{childList:true,subtree:true,attributes:true}});
}})();
</script>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.html(f"""
    <div style="padding:20px 16px 16px;border-bottom:1px solid {BORDER};">
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;background:{ACCENT};border-radius:9px;
                        display:flex;align-items:center;justify-content:center;
                        font-size:12px;font-weight:700;color:#fff;
                        font-family:'JetBrains Mono',monospace;flex-shrink:0;
                        box-shadow:0 4px 12px {ACCENT_DIM};">AX</div>
            <div>
                <div style="font-size:15px;font-weight:700;color:{TEXT1};letter-spacing:-0.3px;">AXIS</div>
                <div style="font-size:10px;color:{TEXT3};margin-top:1px;letter-spacing:0.4px;">
                    Knowledge Layer · v1.0</div>
            </div>
        </div>
    </div>
    """)

    st.html(f"""
    <div style="padding:16px 16px 8px;">
        <span style="font-size:10px;font-weight:600;letter-spacing:1.4px;
                     text-transform:uppercase;color:{TEXT3};">Workspace</span>
    </div>
    """)

    teams = [
        ("All Teams",       None),
        ("Engineering",     "Engineering"),
        ("Data",            "Data"),
        ("CRM",             "CRM"),
        ("Client Success",  "Client Success"),
        ("Product",         "Product"),
    ]

    for label, value in teams:
        active = st.session_state.team_filter == value
        color  = TEAM_COLORS.get(value, ACCENT)
        if active:
            st.html(f"""
            <div style="margin:2px 10px;background:{ACCENT_DIM};border:1px solid {ACCENT}55;
                        border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:9px;">
                <span style="width:7px;height:7px;border-radius:50%;background:{color};
                             flex-shrink:0;display:inline-block;
                             box-shadow:0 0 0 2px {color}44;"></span>
                <span style="font-size:13px;color:{TEXT1};font-weight:500;">{label}</span>
            </div>
            """)
        else:
            if st.button(f"  {label}", key=f"t_{label}", use_container_width=True):
                st.session_state.team_filter = value
                st.rerun()

    # Stats
    doc_counts = get_doc_count()
    total_docs = sum(doc_counts.values())
    queries    = len(st.session_state.messages) // 2

    st.html(f"""
    <div style="margin:12px 10px 0;background:{SURFACE2};border:1px solid {BORDER};
                border-radius:10px;overflow:hidden;">
        <div style="display:flex;">
            <div style="flex:1;text-align:center;padding:12px 4px;border-right:1px solid {BORDER};">
                <div style="font-size:18px;font-weight:700;color:{TEXT1};
                            font-family:'JetBrains Mono',monospace;line-height:1;">{total_docs}</div>
                <div style="font-size:9px;color:{TEXT3};text-transform:uppercase;
                            letter-spacing:0.9px;margin-top:4px;">Docs</div>
            </div>
            <div style="flex:1;text-align:center;padding:12px 4px;border-right:1px solid {BORDER};">
                <div style="font-size:18px;font-weight:700;color:{TEXT1};
                            font-family:'JetBrains Mono',monospace;line-height:1;">5</div>
                <div style="font-size:9px;color:{TEXT3};text-transform:uppercase;
                            letter-spacing:0.9px;margin-top:4px;">Teams</div>
            </div>
            <div style="flex:1;text-align:center;padding:12px 4px;">
                <div style="font-size:18px;font-weight:700;color:{ACCENT_TEXT};
                            font-family:'JetBrains Mono',monospace;line-height:1;">{queries}</div>
                <div style="font-size:9px;color:{TEXT3};text-transform:uppercase;
                            letter-spacing:0.9px;margin-top:4px;">Queries</div>
            </div>
        </div>
    </div>
    """)

    # Data Sync
    st.html(f"""
    <div style="padding:16px 16px 8px;border-top:1px solid {BORDER};margin-top:14px;">
        <span style="font-size:10px;font-weight:600;letter-spacing:1.4px;
                     text-transform:uppercase;color:{TEXT3};">Data Sync</span>
    </div>
    """)

    jira_ok = bool(os.environ.get("JIRA_BASE_URL") and os.environ.get("JIRA_API_TOKEN"))
    if jira_ok:
        c1, c2 = st.columns(2)
        with c1:
            sync_j = st.button("Jira", key="sj", use_container_width=True)
        with c2:
            sync_c = st.button("Confluence", key="sc", use_container_width=True)
        sync_b = st.button("Sync Both", key="sb", use_container_width=True)

        if sync_j or sync_c or sync_b:
            log = []
            with st.spinner("Syncing…"):
                try:
                    if sync_b:
                        res = sync_all(progress_cb=log.append)
                    elif sync_j:
                        from sync import sync_jira
                        res = {"jira": sync_jira(progress_cb=log.append), "confluence": None, "errors": []}
                    else:
                        from sync import sync_confluence
                        res = {"jira": None, "confluence": sync_confluence(progress_cb=log.append), "errors": []}
                    parts = []
                    if res.get("jira"):       parts.append(f"Jira: {res['jira']['synced']}")
                    if res.get("confluence"): parts.append(f"Confluence: {res['confluence']['synced']}")
                    if parts: st.success(" · ".join(parts) + " synced")
                    for e in res.get("errors", []): st.error(e)
                    st.session_state.sync_log = log
                except Exception as e:
                    st.error(str(e))

        if st.session_state.sync_log:
            with st.expander("Sync log"):
                st.text("\n".join(st.session_state.sync_log))
    else:
        st.html(f'<div style="padding:0 16px 10px;font-size:11px;color:{TEXT3};">Configure JIRA env vars to enable.</div>')

    # Add Context
    st.html(f"""
    <div style="padding:16px 16px 8px;border-top:1px solid {BORDER};margin-top:8px;">
        <span style="font-size:10px;font-weight:600;letter-spacing:1.4px;
                     text-transform:uppercase;color:{TEXT3};">Add Context</span>
    </div>
    """)

    with st.form("ctx", clear_on_submit=True):
        team_choice = st.selectbox("Team", ["Engineering","Data","CRM","Client Success","Product"])
        author      = st.text_input("Your name (optional)")
        title_in    = st.text_input("Title", placeholder="What is this about?")
        content_in  = st.text_area("Details", placeholder="Describe in detail…", height=80)
        tags_in     = st.text_input("Tags", placeholder="e.g. deployment, auth")
        if st.form_submit_button("Submit Context", use_container_width=True):
            if title_in.strip() and content_in.strip():
                try:
                    new_id = submit_context(
                        team=team_choice, title=title_in.strip(), content=content_in.strip(),
                        author=author.strip(),
                        tags=[t.strip() for t in tags_in.split(",") if t.strip()]
                    )
                    st.success(f"Saved · {new_id}")
                    st.rerun()
                except Exception as e:
                    st.error(str(e))
            else:
                st.error("Title and details are required.")

    st.html(f'<div style="height:1px;background:{BORDER};margin:12px 0 10px;"></div>')
    st.markdown('<div class="clear-btn">', unsafe_allow_html=True)
    if st.button("Clear conversation", key="clr", use_container_width=True):
        st.session_state.messages = []
        st.session_state.history  = []
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)


# ── Topbar ─────────────────────────────────────────────────────────────────────
scope       = st.session_state.team_filter or "All Teams"
scope_color = TEAM_COLORS.get(st.session_state.team_filter, ACCENT)

top_l, top_r = st.columns([5, 1])
with top_l:
    st.html(f"""
    <div style="padding:14px 28px;border-bottom:1px solid {BORDER};background:{SURFACE};
                display:flex;align-items:center;gap:10px;height:52px;">
        <span style="font-size:14px;font-weight:600;color:{TEXT1};letter-spacing:-0.2px;">
            Ask AXIS</span>
        <span style="display:inline-flex;align-items:center;gap:5px;
                     background:{ACCENT_DIM};border:1px solid {ACCENT}44;
                     border-radius:6px;padding:3px 10px;
                     font-size:11px;color:{ACCENT_TEXT};font-weight:600;
                     font-family:'JetBrains Mono',monospace;">
            <span style="width:5px;height:5px;border-radius:50%;background:{scope_color};
                         display:inline-block;flex-shrink:0;"></span>
            {scope}
        </span>
    </div>
    """)
with top_r:
    st.html(f"""
    <div style="background:{SURFACE};border-bottom:1px solid {BORDER};
                height:52px;display:flex;align-items:center;
                justify-content:flex-end;padding-right:16px;gap:8px;">
    </div>
    """)
    st.markdown(f'<div class="theme-btn" style="margin-top:-44px;display:flex;justify-content:flex-end;padding-right:16px;">', unsafe_allow_html=True)
    toggle_label = "Light mode" if is_dark else "Dark mode"
    if st.button(toggle_label, key="theme_toggle"):
        st.session_state.theme = "light" if is_dark else "dark"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)


# ── Empty state or messages ────────────────────────────────────────────────────
if not st.session_state.messages:
    CARDS = [
        ("Engineering",   "#F59E0B", "How do we deploy to production?"),
        ("Client Success","#10B981", "What is the T2 support SLA?"),
        ("Product",       "#EC4899", "What is the digital card feature status?"),
        ("Data",          "#3B82F6", "What happened with the pipeline failure?"),
    ]
    cards_html = "".join(f"""
        <div style="background:{SURFACE};border:1px solid {BORDER};border-radius:12px;
                    padding:16px 18px;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
                <span style="width:6px;height:6px;border-radius:50%;background:{c};
                             display:inline-block;"></span>
                <span style="font-size:10px;font-weight:600;color:{TEXT3};
                             text-transform:uppercase;letter-spacing:1px;">{tn}</span>
            </div>
            <div style="font-size:13px;color:{TEXT2};line-height:1.6;">{q}</div>
        </div>""" for tn, c, q in CARDS)

    st.html(f"""
    <div style="display:flex;flex-direction:column;align-items:center;
                padding:56px 48px 40px;background:{BG};min-height:400px;">
        <div style="width:52px;height:52px;background:{ACCENT};border-radius:14px;
                    display:flex;align-items:center;justify-content:center;
                    font-size:15px;font-weight:700;color:#fff;margin-bottom:20px;
                    font-family:'JetBrains Mono',monospace;
                    box-shadow:0 8px 24px {ACCENT_DIM};">AX</div>
        <div style="font-size:22px;font-weight:700;color:{TEXT1};margin-bottom:8px;
                    letter-spacing:-0.5px;text-align:center;">
            What do you need to know?</div>
        <div style="font-size:13px;color:{TEXT3};max-width:400px;line-height:1.75;
                    margin-bottom:36px;text-align:center;">
            Instant answers from Engineering, Data, CRM,<br>Client Success, and Product.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;
                    max-width:580px;width:100%;">
            {cards_html}
        </div>
    </div>
    """)
else:
    st.html(f'<div style="height:16px;background:{BG};"></div>')
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.html(f"""
            <div style="display:flex;justify-content:flex-end;
                        padding:4px 40px 10px;background:{BG};">
                <div style="max-width:62%;">
                    <div style="font-size:10px;font-weight:600;letter-spacing:0.8px;
                                text-transform:uppercase;color:{TEXT3};
                                margin-bottom:5px;text-align:right;">You</div>
                    <div style="background:{USER_BG};border:1px solid {USER_BORDER};
                                border-radius:14px 14px 3px 14px;
                                padding:12px 16px;color:{TEXT1};
                                font-size:14px;line-height:1.7;word-wrap:break-word;">
                        {msg["content"]}
                    </div>
                </div>
            </div>
            """)
        else:
            chips_html = ""
            if msg.get("sources"):
                c_inner = ""
                for s in msg["sources"]:
                    t = s["title"][:38] + ("…" if len(s["title"]) > 38 else "")
                    col = TEAM_COLORS.get(s["team"], ACCENT)
                    c_inner += f"""
                    <div style="display:inline-flex;align-items:center;gap:6px;
                                background:{TAG_BG};border:1px solid {BORDER};
                                border-radius:6px;padding:4px 10px;
                                font-size:10px;white-space:nowrap;">
                        <span style="width:5px;height:5px;border-radius:50%;
                                     background:{col};flex-shrink:0;display:inline-block;"></span>
                        <span style="color:{TEXT3};font-weight:500;">{s['team']}</span>
                        <span style="color:{BORDER2};">·</span>
                        <span style="color:{TEXT3};font-family:'JetBrains Mono',monospace;
                                     font-size:9px;">{t}</span>
                        <span style="color:{ACCENT_TEXT};font-weight:700;
                                     font-family:'JetBrains Mono',monospace;">
                            {s['relevance']}%</span>
                    </div>"""
                chips_html = f"""
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;
                             padding-top:12px;border-top:1px solid {BORDER};">
                    {c_inner}
                </div>"""

            body_html = msg["content"].replace("\n", "<br>")
            st.html(f"""
            <div style="display:flex;justify-content:flex-start;
                        padding:4px 40px 10px;background:{BG};">
                <div style="max-width:72%;">
                    <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
                        <div style="width:20px;height:20px;background:{ACCENT};border-radius:5px;
                                    display:flex;align-items:center;justify-content:center;
                                    font-size:8px;font-weight:700;color:#fff;
                                    font-family:'JetBrains Mono',monospace;flex-shrink:0;">AX</div>
                        <span style="font-size:10px;font-weight:600;letter-spacing:0.8px;
                                     text-transform:uppercase;color:{ACCENT_TEXT};">AXIS</span>
                    </div>
                    <div style="background:{SURFACE};border:1px solid {BORDER};
                                border-left:3px solid {ACCENT};
                                border-radius:3px 14px 14px 14px;
                                padding:14px 18px;color:{TEXT2};
                                font-size:14px;line-height:1.8;word-wrap:break-word;">
                        {body_html}
                        {chips_html}
                    </div>
                </div>
            </div>
            """)


# ── Input bar ──────────────────────────────────────────────────────────────────
st.html(f'<div style="height:10px;background:{BG};"></div>')

_key = f"q_{len(st.session_state.messages)}"
st.markdown('<div class="input-row">', unsafe_allow_html=True)
in_col, btn_col = st.columns([12, 1])
with in_col:
    st.markdown('<div class="main-input">', unsafe_allow_html=True)
    user_input = st.text_input("q", placeholder="Ask anything across all teams…",
                               label_visibility="collapsed", key=_key)
    st.markdown('</div>', unsafe_allow_html=True)
with btn_col:
    st.markdown('<div class="send-btn">', unsafe_allow_html=True)
    send = st.button("↑", use_container_width=False)
    st.markdown('</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

st.html(f'<div style="height:28px;background:{BG};"></div>')

# ── Handle query ───────────────────────────────────────────────────────────────
if send and user_input.strip():
    q = user_input.strip()
    st.session_state.messages.append({"role": "user", "content": q})
    with st.spinner(""):
        try:
            answer, sources = ask(q, chat_history=st.session_state.history,
                                  team_filter=st.session_state.team_filter)
            st.session_state.messages.append({
                "role": "assistant",
                "content": answer,
                "sources": sources,
            })
            st.session_state.history.extend([
                {"role": "user",      "content": q},
                {"role": "assistant", "content": answer},
            ])
        except RuntimeError as e:
            st.error(str(e))
    st.rerun()
