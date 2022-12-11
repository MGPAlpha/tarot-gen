const dream = require("dream-api");
const { defaultMaxListeners } = require("events");
const fs = require("fs");
const https = require('https');
const yargs = require('yargs');
const htmlCreator = require('html-creator');

const print = console.log;

var sessionToken = null;

const tarotSettings = [
    {
        name: "Fool",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Magician",
        prefixThe: true,
        altNames: ["Juggler"],
        extraPrompts: []
    },
    {
        name: "High Priestess",
        prefixThe: true,
        altNames: ["Popess"],
        extraPrompts: []
    },
    {
        name: "Empress",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Emperor",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Pope",
        prefixThe: true,
        altNames: ["Hierophant"],
        extraPrompts: []
    },
    {
        name: "Lovers",
        prefixThe: true,
        altNames: ["Marriage"],
        extraPrompts: []
    },
    {
        name: "Chariot",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Justice",
        prefixThe: false,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Hermit",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Wheel of Fortune",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Strength",
        prefixThe: false,
        altNames: ["Fortitude"],
        extraPrompts: []
    },
    {
        name: "Hanged Man",
        prefixThe: true,
        altNames: ["Sacrifice"],
        extraPrompts: []
    },
    {
        name: "Death",
        prefixThe: false,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Temperance",
        prefixThe: false,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Devil",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Tower",
        prefixThe: true,
        altNames: ["House of God"],
        extraPrompts: []
    },
    {
        name: "Star",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Moon",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Sun",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    },
    {
        name: "Judgement",
        prefixThe: false,
        altNames: ["Creation"],
        extraPrompts: []
    },
    {
        name: "World",
        prefixThe: true,
        altNames: [],
        extraPrompts: []
    }
];

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function arrayProductRecursive( ...optionArrays) {
    if (optionArrays.length <= 1) {
        return optionArrays[0].map(v => [v]);
    }
    
    let subOptions1 = optionArrays.slice(0, Math.floor(optionArrays.length/2));
    let subOptions2 = optionArrays.slice(Math.floor(optionArrays.length/2), optionArrays.length);
    
    let combination1 = arrayProductRecursive(...subOptions1);
    let combination2 = arrayProductRecursive(...subOptions2);
    
    let outputs = [];
    for (option1 of combination1) {
        for (option2 of combination2) {
            outputs.push([...option1, ...option2]);
        }
    }
    return outputs;
    
}

function arrayProduct(namestrings = null, ...optionArrays) {
    
    let output = arrayProductRecursive(...optionArrays);
    if (namestrings) {
        output = output.map(v => {
            let o = {};
            for (let i = 0; i < v.length; i++) {
                if (i < namestrings.length) {
                    o[namestrings[i]] = v[i];
                } else {
                    o[i] = v[i];
                }
            }
            return o;
        });
    }
    return output;
}

async function generateNewToken() {
    sessionToken = (await dream.signUp()).idToken;
}

async function beginGeneration(style=1, setName, replace) {
    
    let generations = [];
    
    // await generateNewToken();
    for (index in tarotSettings) {
        let card = tarotSettings[index];
        
        let cardVariations = arrayProduct(["name", "prefixThe", "postfixTarot"], [card.name, ...card.altNames], (card.prefixThe ? [true, false] : [false]), [true, false]);
        cardVariations.push(...arrayProduct(["name", "prefixThe", "postfixTarot"], [...card.extraPrompts], [false], [false]))
        
        let cardPrompts = cardVariations.map(v => {
            let out = v.name;
            if (v.prefixThe) {
                out = "The " + out;
            }
            if (v.postfixTarot) {
                out += " Tarot";
            }
            return out;
        });
        
        let cardGenerations = cardPrompts.map(p => {
            return {
                prompt: p,
                index: index,
                primaryName: card.name
            };
        });
        
        generations.push(...cardGenerations);
    }
    
    let requests = []
    let failures = [];
    
    
    print("Generating Tarot Cards via Wombo Dream API");
    for (gen of generations) {
        const setFolder = `${outputPath}/${setName}`;
        if (!fs.existsSync(setFolder)) {
            fs.mkdirSync(setFolder);
        }
        const genPath = `${setFolder}/${gen.index}_Style${style}_${gen.primaryName}_${gen.prompt}.jpeg`;
        if (!replace && fs.existsSync(genPath)) {
            continue;
        }
        requests.push(dream.generateImage(style, gen.prompt, sessionToken, null, "MEDIUM", false, { "name": "", "public": false, "visible": true }, callback=(result)=>{
            //
        }).then(res => {
            if (res.state != "completed") {
                failures.push(genPath);
                return;
            }
            let url = res.result.final;
            https.get(url,(res) => {
                // Image will be stored at this path
                
                const filePath = fs.createWriteStream(genPath);
                res.pipe(filePath);
                filePath.on('finish',() => {
                    filePath.close();
                    console.log(`Successfully downloaded ${genPath}`); 
                })
            })
        }).catch(err => failures.push(genPath)));
        print(`Requested image for ${genPath}`);
        await sleep(500);
    };
    
    await Promise.all(requests);
    
    if (failures.length > 0) {
        print("Failed generations:")
        print(failures);
    }
    
    
}

async function printStyles() {
    let styles = await dream.getStyles();
    styles.sort((a,b) => a.id-b.id);
    for (style of styles) {
        print(`${style.id}: ${style.name}`);
    }
}

async function generatePage(name) {
    const setFolder = `${outputPath}/${name}`;
    let availableFiles = fs.readdirSync(setFolder);
    availableFiles = availableFiles.filter(file => file.match(/.jpe?g$/ig));
    // print(availableFiles);
    let cardIndexes = availableFiles.map(file => parseInt(file.match(/^(\d+)_/i)[1]));
    cardIndexes = [...(new Set(cardIndexes))];
    cardIndexes = cardIndexes.sort((a, b) => a-b);
    
    let availableStyles = await dream.getStyles();
    
    let cards = cardIndexes.map(i => {
        return {index: i, name: (tarotSettings[i].prefixThe ? "The " : "")+ tarotSettings[i].name}
        // let style = availableStyles.find(style => style.id == i);
        // return {index: i, name: style.name};
    });
    
    let styles = availableFiles.map(file => parseInt(file.match(/^\d+_Style(\d+)/i)[1]));
    styles = [...new Set(styles)];
    styles = styles.sort((a,b) => a-b);
    
    styles = styles.map(i => {
        let style = availableStyles.find(style => style.id == i);
        return {id: i, name: style.name};
    });
    
    print(cards);
    print(styles);
    
    let styleNodes = styles.map(style => {
        let node = {type: 'div', content: [
            {type: 'h1', content: `Style: ${style.name} (id ${style.id})`},
            {type: 'table', attributes: {width: "100%", style: "table-layout: fixed;"}, content: cards.map(card => {
                let relatedGenerations = availableFiles.filter(c => c.indexOf(`${card.index}_Style${style.id}`) == 0);
                // print(relatedGenerations);
                let node = {type: 'tr', content: [
                    {type: 'td', content: `${card.index}: ${card.name}`},
                    ...relatedGenerations.map(image => {
                        print(image.match(/^\d+_Style\d+_[^_]+_([^\.]*)\.jpe?g/i)[1]);
                        let imageNodes = [
                            {type: 'td', content: `"${image.match(/^\d+_Style\d+_[^_]+_([^\.]*)\.jpe?g/i)[1]}"`},
                            {type: 'td', content: [{type: 'img', attributes: {src: image, width: "100%", style: "object-fit: scale-down;"}}]}
                        ]
                        return imageNodes;
                    }).flat()
                ]};
                return node;
            })}
        ]}
        return node;
    });
    
    const pageNode = [
        {
            type: 'head',
            content: [{ type: 'title', content: 'Generated HTML' }]
        },
        {
            type: 'body',
            attributes: { style: 'padding: 1rem' },
            content: styleNodes,
        },
    ];

    let html = new htmlCreator(pageNode);
    await html.renderHTMLToFile(`${setFolder}/index.html`);
}

const outputPath = `${__dirname}/files`;

const defaultStyle = 1;
const defaultSetName = new Date(Date.now()).toISOString();
const defaultReplace = false;

if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
}

const argv = yargs
.command("all", "Generate full tarot set with Wombo Dream")
.command("interactive", "Interactive generator")
.command("styles", "Get available styles from Wombo Dream")
.command("page", "Generate HTML document with all generated images for a given set")
.option("style", {
    alias: 's',
    description: "Generate with a particular style",
    type: "number"
})
.option("setname", {
    alias: 'n',
    description: "Name of folder to generate results in",
    type: "string"
})
.option("replace", {
    alias: 'r',
    description: "Replace old generations",
    type: "boolean"
})
.argv;



if (argv._.includes("styles")) {
    printStyles();
    return;
} else if (argv._.includes("page")) {
    if (!argv.setname) {
        print("Command requires a set name for an existing set");
        return;
    }
    let name = argv.setname;
    generatePage(name);
} else {
    
    let style = defaultStyle;
    let setName = defaultSetName;
    let replace = defaultReplace;
    
    
    if (argv.style) {
        style = argv.style;
    }
    if (argv.setname) {
        setName = argv.setname;
    }
    if (argv.replace) {
        replace = argv.replace;
    }
    
    beginGeneration(style, setName, replace);
}



// beginGeneration();