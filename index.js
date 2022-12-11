const dream = require("dream-api");
const { defaultMaxListeners } = require("events");
const fs = require("fs");
const https = require('https');
const yargs = require('yargs');

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
    }
]

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

    let failures = [];

    

    await Promise.all(generations.map(gen => {
        const setFolder = `${outputPath}/${setName}`;
        if (!fs.existsSync(setFolder)) {
            fs.mkdirSync(setFolder);
        }
        const genPath = `${setFolder}/${gen.index}_Style${style}_${gen.primaryName}_${gen.prompt}.jpeg`;
        if (!replace && fs.existsSync(genPath)) {
            return null;
        }
        return dream.generateImage(style, gen.prompt, sessionToken, null, "MEDIUM", false, { "name": "", "public": false, "visible": true }, callback=(result)=>{
            //
        }).then(res => {
            if (res.state != "completed") {
                failures.push({
                    file: genPath,
                    reason: res
                });
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
        }).catch(err => failures.push(genPath));
    }));

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
} else if (argv._.includes("interactive")) {

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