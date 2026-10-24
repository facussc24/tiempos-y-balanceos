import win32com.client
powerpoint = win32com.client.Dispatch('PowerPoint.Application')
habia_abiertas = powerpoint.Presentations.Count   # PowerPoint es de una sola instancia: si Fak tiene un deck abierto, no se le cierra
print('PowerPoint COM OK')
if habia_abiertas == 0 and powerpoint.Presentations.Count == 0:
    powerpoint.Quit()
