"""Acuse de ejecución para Blender portable y el launcher de Microsoft Store."""
import contextlib
import json
import os
from pathlib import Path
import runpy
import sys
import traceback
import bpy

parameters = sys.argv[sys.argv.index('--') + 1:]
report, script, *arguments = parameters
report_path = Path(report)
result = {'ok': False, 'blender': bpy.app.version_string, 'script': script}
with report_path.with_suffix('.log').open('w', encoding='utf-8') as log:
    with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
        try:
            if script != 'probe':
                sys.argv = [script, '--', *arguments]
                runpy.run_path(script, run_name='__main__')
            result['ok'] = True
        except BaseException:
            result['error'] = traceback.format_exc()
            print(result['error'])
temporary = report_path.with_suffix('.pending')
temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
os.replace(temporary, report_path)
