"""
_purgarBorradoresNovax.py
Elimina borradores viejos o duplicados de NOVAX en la carpeta Borradores de Outlook.
"""
import win32com.client

ol = win32com.client.Dispatch('Outlook.Application')
ns = ol.GetNamespace('MAPI')
drafts = ns.GetDefaultFolder(16) # olFolderDrafts
items = drafts.Items

eliminados = 0
# Recorrer de atras hacia adelante para no romper indices al borrar
for i in range(items.Count, 0, -1):
    try:
        item = items.Item(i)
        sub = str(getattr(item, 'Subject', '') or '')
        if 'NOVAX' in sub:
            print(f'Eliminando borrador viejo: {sub} ({item.Attachments.Count} adjuntos, Mod: {item.LastModificationTime})')
            item.Delete()
            eliminados += 1
    except Exception as e:
        print(f'Error al revisar item {i}: {e}')

print(f'Total borradores de NOVAX eliminados: {eliminados}')
