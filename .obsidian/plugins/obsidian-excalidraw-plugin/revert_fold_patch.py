import sys
# Revert the Excalidraw fold-lock patch
with open(sys.argv[1], "r") as f:
    content = f.read()

patch_str = "setInterval(()=>{try{const p=EXCALIDRAW_PLUGIN;if(!p||!p.app||!p.isReady)return;const l=p.app.workspace.getLeavesOfType(\"markdown\");for(const e of l)if(e.view instanceof obsidian_module.MarkdownView&&p.isExcalidrawFile(e.view.file))foldExcalidrawSection(e.view)}catch(e){}},300);"

if patch_str in content:
    content = content.replace(patch_str, "")
    with open(sys.argv[1], "w") as f:
        f.write(content)
    print("Patch reverted successfully.")
else:
    print("Patch not found - may already be reverted.")
