function L(t){if(t==null)return"";if(typeof t=="number")return t;let n=String(t);return n.length>0&&`=@+-	\r
`.includes(n[0])&&(n="'"+n),n.length>32767&&(n=n.substring(0,32767)),n}export{L as s};
