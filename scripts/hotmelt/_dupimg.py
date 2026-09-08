import zipfile, re, hashlib, collections
z=zipfile.ZipFile('_deck.pptx')
names=z.namelist()
slides=sorted([n for n in names if re.match(r'ppt/slides/slide\d+\.xml$',n)], key=lambda n:int(re.findall(r'\d+',n)[0]))
md5={}
for n in names:
    if n.startswith('ppt/media/'):
        md5[n]=hashlib.md5(z.read(n)).hexdigest()
use=collections.defaultdict(list)
for s in slides:
    idx=int(re.findall(r'\d+',s)[0])
    rels=f'ppt/slides/_rels/slide{idx}.xml.rels'
    r=z.read(rels).decode('utf8')
    m={a:b for a,b in re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"',r)}
    xml=z.read(s).decode('utf8')
    order=re.findall(r'r:embed="(rId\d+)"',xml)
    for rid in order:
        t=m.get(rid,'?').replace('../','ppt/')
        use[idx].append((t, md5.get(t,'?')[:10]))
# report
print("SLIDE -> imagenes (md5 corto)")
h2s=collections.defaultdict(list)
for k in sorted(use):
    print(f" L{k:>2}: "+", ".join(f"{t.split('/')[-1]}={h}" for t,h in use[k]))
    for t,h in use[k]: h2s[h].append(k)
print("\nHASHES REPETIDOS EN MAS DE UNA LAMINA:")
for h,ls in h2s.items():
    if len(set(ls))>1 or len(ls)>1:
        print(f"  {h} -> laminas {ls}")
