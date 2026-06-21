import json
with open('m.json', 'r') as f:
    data = json.load(f)

seen = set()
result = []
for i in data:
    key = (i["donors.display_title"], i["sample_summary.category"], i["sample_summary.tissues"])
    if key not in seen:
        seen.add(key)
        result.append([
            i["donors.display_title"],
            i["sample_summary.category"],
            i["sample_summary.tissues"]
        ])

with open('m_output.tsv', 'w') as f:
    for item in result:
        f.write('{}\t{}\t{}\n'.format(item[0], item[1], item[2]))
