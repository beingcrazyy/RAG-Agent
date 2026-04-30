import os

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    c = c.replace('{ \"Authorization\": \"Bearer \" }', '{ \"Authorization\": Bearer  }')
    c = c.replace(\"const assistantLogoSrc = user?.logo_url ?  : '/logo.png';\", 'const assistantLogoSrc = user?.logo_url ? ${apiBase} : \'/logo.png\';')
    c = c.replace('fetch(/api/v1/chat/threads//messages, ', 'fetch(${apiBase}/api/v1/chat/threads//messages, ')
    c = c.replace('fetch(/api/v1/chat/threads/, ', 'fetch(${apiBase}/api/v1/chat/threads/, ')
    c = c.replace('fetch(/api/v1/documents/suggestions?workspace_id=, ', 'fetch(${apiBase}/api/v1/documents/suggestions?workspace_id=, ')
    c = c.replace('fetch(/api/v1/chat/, ', 'fetch(${apiBase}/api/v1/chat/, ')
    c = c.replace('content: \"Hi! I\\'m your  AI assistant. I can answer questions based on your knowledge base. What would you like to know?\" }]', 'content: Hi! I\\'m your  AI assistant. I can answer questions based on your knowledge base. What would you like to know? }]')
    c = c.replace('const tempUserId = \"user-\";', 'const tempUserId = user-;')
    c = c.replace('const tempAssistantId = \"assist-\";', 'const tempAssistantId = ssist-;')
    c = c.replace('animationDelay: \"ms\"', 'animationDelay: ${i*150}ms')
    c = c.replace('placeholder={\"Ask  anything...\"}', 'placeholder={Ask  anything...}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

fix_file('frontend/src/components/CurrentChat.tsx')

def fix_sidebar(path):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    
    c = c.replace('{ \"Authorization\": \"Bearer \" }', '{ \"Authorization\": Bearer  }')
    c = c.replace(\"const logoSrc = user?.logo_url ?  : '/logo.png';\", 'const logoSrc = user?.logo_url ? ${apiBase} : \'/logo.png\';')
    c = c.replace('fetch(/api/v1/chat/threads?workspace_id=, ', 'fetch(${apiBase}/api/v1/chat/threads?workspace_id=, ')
    c = c.replace('fetch(/api/v1/chat/threads/, ', 'fetch(${apiBase}/api/v1/chat/threads/, ')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

fix_sidebar('frontend/src/components/Sidebar.tsx')

print(\"Fixed\")