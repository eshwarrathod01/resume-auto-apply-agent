"""
Resume Auto Apply Agent - Streamlit Dashboard
Automatically submit job applications on ATS platforms
"""

import streamlit as st
import json
import time
import re
from datetime import datetime
import requests
from urllib.parse import urlparse

# Page configuration
st.set_page_config(
    page_title="Resume Auto Apply Agent",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;   
        font-weight: bold;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 1rem;
    }
    .platform-card {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 1.5rem;
        border-radius: 10px;
        margin: 0.5rem 0;
    }
    .status-success { color: #28a745; font-weight: bold; }
    .status-pending { color: #ffc107; font-weight: bold; }
    .status-error { color: #dc3545; font-weight: bold; }
    .stButton>button {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.5rem 2rem;
        border-radius: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'profile' not in st.session_state:
    st.session_state.profile = {
        'firstName': '',
        'lastName': '',
        'email': '',
        'phone': '',
        'linkedin': '',
        'portfolio': '',
        'currentCompany': '',
        'currentTitle': '',
        'yearsExperience': '',
        'location': '',
        'workAuthorization': 'Authorized to work',
        'sponsorship': 'No'
    }

if 'applications' not in st.session_state:
    st.session_state.applications = []

if 'resume_content' not in st.session_state:
    st.session_state.resume_content = None

if 'cover_letter_content' not in st.session_state:
    st.session_state.cover_letter_content = None


def detect_platform(url):
    """Detect ATS platform from URL"""
    url_lower = url.lower()
    if 'lever.co' in url_lower or 'jobs.lever.co' in url_lower:
        return 'Lever', '🎯'
    elif 'greenhouse.io' in url_lower or 'boards.greenhouse.io' in url_lower:
        return 'Greenhouse', '🌿'
    elif 'workday' in url_lower or 'myworkday' in url_lower:
        return 'Workday', '💼'
    elif 'glassdoor' in url_lower:
        return 'Glassdoor', '🚪'
    elif 'linkedin' in url_lower:
        return 'LinkedIn', '🔗'
    elif 'indeed' in url_lower:
        return 'Indeed', '📋'
    else:
        return 'Unknown', '❓'


def extract_job_info(url):
    """Extract job information from URL"""
    try:
        parsed = urlparse(url)
        path_parts = parsed.path.strip('/').split('/')
        
        # Try to extract company and job title from URL
        company = parsed.netloc.split('.')[0] if parsed.netloc else 'Unknown'
        job_id = path_parts[-1] if path_parts else 'Unknown'
        
        return {
            'company': company.replace('-', ' ').title(),
            'job_id': job_id,
            'url': url
        }
    except:
        return {'company': 'Unknown', 'job_id': 'Unknown', 'url': url}


def generate_application_script(platform, profile, job_url):
    """Generate automation script for the platform"""
    
    scripts = {
        'Lever': f'''
// Lever Auto-Fill Script (Enhanced for Ekimetrics and similar forms)
// Paste this in browser console on: {job_url}

(async function() {{
    const profile = {json.dumps(profile, indent=2)};
    
    // Helper functions
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    const fillField = async (selector, value) => {{
        const el = document.querySelector(selector);
        if (el && value) {{
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            await sleep(100);
            return true;
        }}
        return false;
    }};
    
    const selectRadioByText = async (container, text) => {{
        const radios = container.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {{
            const label = radio.closest('label') || radio.parentElement;
            if (label && label.textContent.toLowerCase().includes(text.toLowerCase())) {{
                radio.click();
                await sleep(100);
                return true;
            }}
        }}
        return false;
    }};
    
    const selectCheckboxByText = async (container, texts) => {{
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const textArr = Array.isArray(texts) ? texts : [texts];
        for (const checkbox of checkboxes) {{
            const label = checkbox.closest('label') || checkbox.parentElement;
            if (label) {{
                for (const text of textArr) {{
                    if (label.textContent.toLowerCase().includes(text.toLowerCase()) && !checkbox.checked) {{
                        checkbox.click();
                        await sleep(100);
                    }}
                }}
            }}
        }}
    }};
    
    const findQuestionByText = (searchText) => {{
        const labels = document.querySelectorAll('label, h3, h4, legend');
        for (const label of labels) {{
            if (label.textContent.toLowerCase().includes(searchText.toLowerCase())) {{
                return label.closest('li, fieldset, .application-question, div');
            }}
        }}
        return null;
    }};
    
    // Fill basic fields
    console.log('📝 Filling basic fields...');
    await fillField('input[name="name"]', profile.firstName + ' ' + profile.lastName);
    await fillField('input[name="email"]', profile.email);
    await fillField('input[name="phone"]', profile.phone);
    await fillField('input[name="location"]', profile.location);
    await fillField('input[name="org"]', profile.currentCompany);
    await fillField('input[name="urls[LinkedIn]"]', profile.linkedin);
    await fillField('input[name="urls[Portfolio]"]', profile.portfolio);
    await fillField('input[name="urls[GitHub]"]', profile.portfolio);
    
    // Fill text-based questions
    console.log('📝 Filling application questions...');
    
    // Notice period
    let q = findQuestionByText('notice period');
    if (q) {{
        const input = q.querySelector('input[type="text"], textarea');
        if (input) {{ input.value = '2 weeks'; input.dispatchEvent(new Event('input', {{bubbles:true}})); }}
    }}
    
    // Start date
    q = findQuestionByText('start date');
    if (q) {{
        const input = q.querySelector('input[type="text"], textarea');
        if (input) {{ input.value = 'Immediately available'; input.dispatchEvent(new Event('input', {{bubbles:true}})); }}
    }}
    
    // Salary
    q = findQuestionByText('salary');
    if (q) {{
        const input = q.querySelector('input[type="text"], textarea');
        if (input) {{ input.value = '$75,000 - $85,000'; input.dispatchEvent(new Event('input', {{bubbles:true}})); }}
    }}
    
    // Languages
    q = findQuestionByText('languages');
    if (q) await selectCheckboxByText(q, ['english']);
    
    // How did you hear
    q = findQuestionByText('hear about');
    if (q) {{
        const input = q.querySelector('input[type="text"], textarea');
        if (input) {{ input.value = 'Online Job Board'; input.dispatchEvent(new Event('input', {{bubbles:true}})); }}
    }}
    
    // Visa status
    q = findQuestionByText('visa') || findQuestionByText('require a visa');
    if (q) await selectRadioByText(q, 'american citizen');
    
    // If visa type question
    q = findQuestionByText('what visa');
    if (q) {{
        const input = q.querySelector('input[type="text"], textarea');
        if (input) {{ input.value = 'N/A - US Citizen'; input.dispatchEvent(new Event('input', {{bubbles:true}})); }}
    }}
    
    // Open to working in office
    q = findQuestionByText('open to working');
    if (q) await selectRadioByText(q, 'yes');
    
    // Coding language
    q = findQuestionByText('coding language') || findQuestionByText('python or r');
    if (q) await selectRadioByText(q, 'python');
    
    // Consent checkbox
    q = findQuestionByText('consent') || findQuestionByText('retain');
    if (q) {{
        const checkbox = q.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) checkbox.click();
    }}
    
    console.log('✅ Form auto-filled! Please:');
    console.log('1. Upload your resume');
    console.log('2. Review all fields');
    console.log('3. Complete any remaining questions');
    console.log('4. Click Submit');
    
    alert('✅ Form auto-filled!\\n\\nPlease:\\n1. Upload your resume\\n2. Review all fields\\n3. Complete any remaining questions\\n4. Click Submit');
}})();
''',
        'Greenhouse': f'''
// Greenhouse Auto-Fill Script  
// Paste this in browser console on: {job_url}

(function() {{
    const profile = {json.dumps(profile, indent=2)};
    
    const fieldMappings = {{
        '#first_name': profile.firstName,
        '#last_name': profile.lastName,
        '#email': profile.email,
        '#phone': profile.phone,
        'input[autocomplete="url"]': profile.linkedin,
    }};
    
    for (const [selector, value] of Object.entries(fieldMappings)) {{
        const el = document.querySelector(selector);
        if (el && value) {{
            el.value = value;
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}
    }}
    
    console.log('✅ Greenhouse form auto-filled!');
    alert('Form fields have been filled. Please review and upload your resume manually.');
}})();
''',
        'Workday': f'''
// Workday Auto-Fill Script
// Paste this in browser console on: {job_url}

(function() {{
    const profile = {json.dumps(profile, indent=2)};
    
    // Workday uses dynamic IDs, so we search by labels
    function fillByLabel(labelText, value) {{
        const labels = document.querySelectorAll('label');
        for (const label of labels) {{
            if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {{
                const input = label.closest('[data-automation-id]')?.querySelector('input, textarea');
                if (input) {{
                    input.value = value;
                    input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }}
            }}
        }}
    }}
    
    fillByLabel('first name', profile.firstName);
    fillByLabel('last name', profile.lastName);
    fillByLabel('email', profile.email);
    fillByLabel('phone', profile.phone);
    
    console.log('✅ Workday form auto-filled!');
    alert('Form fields have been filled. Please review and complete remaining fields manually.');
}})();
''',
        'Glassdoor': f'''
// Glassdoor Auto-Fill Script
// Paste this in browser console on: {job_url}

(function() {{
    const profile = {json.dumps(profile, indent=2)};
    
    const fieldMappings = {{
        'input[name="firstName"]': profile.firstName,
        'input[name="lastName"]': profile.lastName,
        'input[name="email"]': profile.email,
        'input[name="phone"]': profile.phone,
    }};
    
    for (const [selector, value] of Object.entries(fieldMappings)) {{
        const el = document.querySelector(selector);
        if (el && value) {{
            el.value = value;
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
        }}
    }}
    
    console.log('✅ Glassdoor form auto-filled!');
    alert('Form fields have been filled. Please review and upload your resume manually.');
}})();
'''
    }
    
    return scripts.get(platform, '// Platform not supported for auto-fill')


# Sidebar - Profile Setup
with st.sidebar:
    st.markdown("### 👤 Your Profile")
    
    with st.expander("Personal Information", expanded=True):
        st.session_state.profile['firstName'] = st.text_input("First Name", st.session_state.profile['firstName'])
        st.session_state.profile['lastName'] = st.text_input("Last Name", st.session_state.profile['lastName'])
        st.session_state.profile['email'] = st.text_input("Email", st.session_state.profile['email'])
        st.session_state.profile['phone'] = st.text_input("Phone", st.session_state.profile['phone'])
    
    with st.expander("Professional Links"):
        st.session_state.profile['linkedin'] = st.text_input("LinkedIn URL", st.session_state.profile['linkedin'])
        st.session_state.profile['portfolio'] = st.text_input("Portfolio/GitHub", st.session_state.profile['portfolio'])
    
    with st.expander("Current Position"):
        st.session_state.profile['currentCompany'] = st.text_input("Current Company", st.session_state.profile['currentCompany'])
        st.session_state.profile['currentTitle'] = st.text_input("Current Title", st.session_state.profile['currentTitle'])
        st.session_state.profile['yearsExperience'] = st.text_input("Years of Experience", st.session_state.profile['yearsExperience'])
    
    with st.expander("Work Authorization"):
        st.session_state.profile['location'] = st.text_input("Location", st.session_state.profile['location'])
        st.session_state.profile['workAuthorization'] = st.selectbox(
            "Work Authorization",
            ["Authorized to work", "Require sponsorship", "Other"]
        )
    
    st.markdown("---")
    
    st.markdown("### 📄 Documents")
    resume_file = st.file_uploader("Upload Resume (PDF)", type=['pdf', 'docx'])
    if resume_file:
        st.session_state.resume_content = resume_file.read()
        st.success(f"✅ {resume_file.name} uploaded")
    
    cover_letter_file = st.file_uploader("Upload Cover Letter (Optional)", type=['pdf', 'docx', 'txt'])
    if cover_letter_file:
        st.session_state.cover_letter_content = cover_letter_file.read()
        st.success(f"✅ {cover_letter_file.name} uploaded")


# Main Content
st.markdown('<p class="main-header">📄 Resume Auto Apply Agent</p>', unsafe_allow_html=True)
st.markdown("Automatically fill job applications on ATS platforms like Lever, Greenhouse, Workday, and more.")

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["🚀 Apply Now", "📊 Application Tracker", "⚙️ Settings", "📖 Help"])

with tab1:
    st.markdown("### Enter Job URL")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        job_url = st.text_input(
            "Job Application URL",
            placeholder="https://jobs.lever.co/company/job-id",
            label_visibility="collapsed"
        )
    with col2:
        analyze_btn = st.button("🔍 Analyze", use_container_width=True)
    
    if job_url and analyze_btn:
        platform, icon = detect_platform(job_url)
        job_info = extract_job_info(job_url)
        
        st.markdown("---")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Platform", f"{icon} {platform}")
        with col2:
            st.metric("Company", job_info['company'])
        with col3:
            st.metric("Status", "Ready to Apply")
        
        if platform != 'Unknown':
            st.markdown("### 📝 Application Preview")
            
            # Show profile summary
            with st.expander("Your Information (Click to verify)", expanded=True):
                col1, col2 = st.columns(2)
                with col1:
                    st.write(f"**Name:** {st.session_state.profile['firstName']} {st.session_state.profile['lastName']}")
                    st.write(f"**Email:** {st.session_state.profile['email']}")
                    st.write(f"**Phone:** {st.session_state.profile['phone']}")
                with col2:
                    st.write(f"**Current Role:** {st.session_state.profile['currentTitle']}")
                    st.write(f"**Company:** {st.session_state.profile['currentCompany']}")
                    st.write(f"**LinkedIn:** {st.session_state.profile['linkedin']}")
            
            # Check if profile is complete
            required_fields = ['firstName', 'lastName', 'email']
            missing_fields = [f for f in required_fields if not st.session_state.profile.get(f)]
            
            if missing_fields:
                st.warning(f"⚠️ Please fill in required fields in the sidebar: {', '.join(missing_fields)}")
            else:
                st.markdown("### 🎯 Auto-Fill Script")
                st.info("Since Streamlit Cloud cannot directly control your browser, copy the script below and paste it in your browser's console on the job page.")
                
                script = generate_application_script(platform, st.session_state.profile, job_url)
                
                st.code(script, language='javascript')
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    if st.button("📋 Copy Script", use_container_width=True):
                        st.toast("Script copied! Paste it in browser console (F12 → Console)")
                
                with col2:
                    st.link_button("🔗 Open Job Page", job_url, use_container_width=True)
                
                with col3:
                    if st.button("✅ Mark as Applied", use_container_width=True):
                        st.session_state.applications.append({
                            'url': job_url,
                            'company': job_info['company'],
                            'platform': platform,
                            'date': datetime.now().strftime("%Y-%m-%d %H:%M"),
                            'status': 'Applied'
                        })
                        st.success("Application tracked!")
                        st.balloons()
                
                st.markdown("---")
                st.markdown("#### 📌 How to use:")
                st.markdown("""
                1. Click **Open Job Page** to go to the application
                2. Press **F12** to open Developer Tools
                3. Go to the **Console** tab
                4. Paste the script and press **Enter**
                5. Review the filled fields and upload your resume
                6. Submit the application
                7. Come back and click **Mark as Applied** to track it
                """)
        else:
            st.error("❌ Platform not recognized. Supported platforms: Lever, Greenhouse, Workday, Glassdoor")

with tab2:
    st.markdown("### 📊 Application Tracker")
    
    if st.session_state.applications:
        # Summary metrics
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Applications", len(st.session_state.applications))
        with col2:
            applied = len([a for a in st.session_state.applications if a['status'] == 'Applied'])
            st.metric("Applied", applied)
        with col3:
            interviews = len([a for a in st.session_state.applications if a['status'] == 'Interview'])
            st.metric("Interviews", interviews)
        with col4:
            offers = len([a for a in st.session_state.applications if a['status'] == 'Offer'])
            st.metric("Offers", offers)
        
        st.markdown("---")
        
        # Application list
        for i, app in enumerate(reversed(st.session_state.applications)):
            with st.container():
                col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
                with col1:
                    st.write(f"**{app['company']}**")
                    st.caption(app['platform'])
                with col2:
                    st.write(app['date'])
                with col3:
                    new_status = st.selectbox(
                        "Status",
                        ["Applied", "Interview", "Rejected", "Offer", "Withdrawn"],
                        index=["Applied", "Interview", "Rejected", "Offer", "Withdrawn"].index(app['status']),
                        key=f"status_{i}",
                        label_visibility="collapsed"
                    )
                    idx = len(st.session_state.applications) - 1 - i
                    st.session_state.applications[idx]['status'] = new_status
                with col4:
                    st.link_button("🔗", app['url'])
                st.markdown("---")
    else:
        st.info("No applications tracked yet. Start applying to jobs in the 'Apply Now' tab!")

with tab3:
    st.markdown("### ⚙️ Settings")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### Export/Import Profile")
        
        if st.button("📤 Export Profile"):
            profile_json = json.dumps(st.session_state.profile, indent=2)
            st.download_button(
                "Download Profile JSON",
                profile_json,
                "profile.json",
                "application/json"
            )
        
        uploaded_profile = st.file_uploader("Import Profile", type=['json'])
        if uploaded_profile:
            try:
                imported = json.load(uploaded_profile)
                st.session_state.profile.update(imported)
                st.success("Profile imported successfully!")
            except:
                st.error("Invalid profile file")
    
    with col2:
        st.markdown("#### Export Applications")
        
        if st.session_state.applications:
            if st.button("📤 Export Applications"):
                apps_json = json.dumps(st.session_state.applications, indent=2)
                st.download_button(
                    "Download Applications JSON",
                    apps_json,
                    "applications.json",
                    "application/json"
                )
    
    st.markdown("---")
    st.markdown("#### 🔄 Reset Data")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🗑️ Clear Applications", type="secondary"):
            st.session_state.applications = []
            st.success("Applications cleared!")
    with col2:
        if st.button("🗑️ Reset Profile", type="secondary"):
            for key in st.session_state.profile:
                st.session_state.profile[key] = ''
            st.success("Profile reset!")

with tab4:
    st.markdown("### 📖 Help & Documentation")
    
    with st.expander("🎯 Supported Platforms"):
        st.markdown("""
        | Platform | Status | Notes |
        |----------|--------|-------|
        | Lever | ✅ Full Support | Auto-fills all standard fields |
        | Greenhouse | ✅ Full Support | Auto-fills all standard fields |
        | Workday | ⚠️ Partial | Complex forms may need manual completion |
        | Glassdoor | ✅ Full Support | Auto-fills all standard fields |
        | LinkedIn | 🔜 Coming Soon | Easy Apply support planned |
        | Indeed | 🔜 Coming Soon | In development |
        """)
    
    with st.expander("🔧 How It Works"):
        st.markdown("""
        1. **Fill Your Profile**: Enter your information in the sidebar
        2. **Upload Resume**: Upload your resume PDF
        3. **Paste Job URL**: Enter the job application URL
        4. **Get Auto-Fill Script**: Copy the generated JavaScript
        5. **Apply**: Open the job page, paste script in console
        6. **Track**: Mark applications as applied to track them
        """)
    
    with st.expander("❓ FAQ"):
        st.markdown("""
        **Q: Why can't the app fill forms automatically?**
        
        A: Streamlit Cloud runs on a server and cannot directly control your local browser. 
        The script approach allows you to auto-fill while maintaining security.
        
        **Q: Is my data secure?**
        
        A: Your data is stored only in your browser session and is not sent to any external servers.
        
        **Q: Can I use the Chrome extension?**
        
        A: Yes! The Chrome extension (in the `extension/` folder) provides direct auto-fill 
        capability. Load it in Chrome via Developer Mode.
        """)
    
    with st.expander("🚀 Chrome Extension"):
        st.markdown("""
        For the best experience, use our Chrome Extension:
        
        1. Go to `chrome://extensions/`
        2. Enable "Developer mode"
        3. Click "Load unpacked"
        4. Select the `extension/` folder from this project
        5. The extension will auto-fill forms directly!
        
        **GitHub Repository:** [eshwarrathod01/resume-auto-apply-agent](https://github.com/eshwarrathod01/resume-auto-apply-agent)
        """)

# Footer
st.markdown("---")
st.markdown(
    "<p style='text-align: center; color: #888;'>Resume Auto Apply Agent | Made with ❤️ using Streamlit</p>",
    unsafe_allow_html=True
)
