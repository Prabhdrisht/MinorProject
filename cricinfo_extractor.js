//node cricinfo_extractor.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --excel=Worldcup.csv --dataFolder=data
let minimist=require("minimist");
let axios=require("axios");
let jsdom=require("jsdom");
let excel=require("excel4node");
let pdf=require("pdf-lib");
let args=minimist(process.argv);
let fs=require("fs");
let path=require("path");

//download using axios
dldPromise=axios.get(args.source);
dldPromise.then
(
    function(response)
    {
        let html=response.data;

        //extract information using jsdom
        let dom=new jsdom.JSDOM(html);
        let document=dom.window.document;
        let matchScoreDivs=document.querySelectorAll("div.match-score-block");
        let matches=[];//array of matches
        for(let i=0;i<matchScoreDivs.length;i++)//loop in matchScoreDivs array
        {
            let match=//object
            {
                t1: "",
                t2: "",
                t1s: "",
                t2s: "",
                result: ""
            };
            let namePs=matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
            match.t1=namePs[0].textContent;
            match.t2=namePs[1].textContent;
            let scoreSpans=matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");
            if(scoreSpans.length==2)//both teams got to bat
            {
                match.t1s=scoreSpans[0].textContent;
                match.t2s=scoreSpans[1].textContent;
            }
            else if(scoreSpans.length==1)//only one team got to bat
            {
                match.t1s=scoreSpans[0].textContent;
                match.t2s="";
            }
            else//nobody got to bat
            {
                match.t1s="";
                match.t2s="";
            }
            let spanResult=matchScoreDivs[i].querySelector("div.status-text>span");
            match.result=spanResult.textContent;
            matches.push(match);
        }
        let matchesJSON=JSON.stringify(matches);//jso needs to be stringfied for printing or saving
        fs.writeFileSync("matches.json",matchesJSON,"utf-8");//writing matchesJSON into a file named matches.json

        //manipulate data using array functions
        let teams=[];//array of teams
        
        for(let i=0;i<matches.length;i++)//loop in matches array
        {
            populateTeams(teams,matches[i]);//puts t1 and t2 of match(i.e. matches[i]) in teams array if missing
        }
        //teams array has all the team names

        //similarly for matches object of teams array
        for(let i=0;i<matches.length;i++)//loop in matches array
        {
            populateMatchesInTeam(teams,matches[i]);//puts match(i.e. matches[i]) in matches object of teams array
        }
        //matches object of teams array has all the matches of the team

        let teamsJSON=JSON.stringify(teams);//jso needs to be stringfied for printing or saving
        fs.writeFileSync("teams.json",teamsJSON,"utf-8");//writing teamsJSON into a file named teams.json

        //writing extracted data in excel file using excel4node
        createExcel(teams,args.excel);

        //create folders using fs
        createFolders(teams,args.dataFolder);
    }
)
.catch
(
    function(err)
    {
        console.log(err);
    }
);

function createFolders(teams,dataDir)//similar to code of pdf.js created previously
{
    if(fs.existsSync(dataDir)==true)//existsSync checks if folder already present,true means folder already present
    {
        fs.rmdirSync(dataDir,{recursive:true});// to delete non empty folder
    }
    fs.mkdirSync(dataDir);
    for(let i=0;i<teams.length;i++)
    {
        let teamFolder=path.join(dataDir,teams[i].name);
        fs.mkdirSync(teamFolder);
        for(let j=0;j<teams[i].matches.length;j++)//number of matches should be equal to number of pdf files so loop in matches object of teams array
        {
            let matchFileName=path.join(teamFolder,teams[i].matches[j].vs);
            createScoreCard(teams[i].name,teams[i].matches[j],matchFileName);
        }
    }
}

function createScoreCard(teamName,match,matchFileName)
{
    let t1=teamName;
    let t2=match.vs;
    let t1s=match.selfScore;
    let t2s=match.oppScore;
    let result=match.result;
    let templateBytes=fs.readFileSync("template.pdf");
    let prmToLoadBytes=pdf.PDFDocument.load(templateBytes);
    prmToLoadBytes.then
    (
        function(pdfDoc)
        {
            let page=pdfDoc.getPage(0);//gives 0th page pf pdf
            page.drawText
            (
                t1,
                {
                    x:303,
                    y:725,
                    size:10
                }
            );
            page.drawText
            (
                t2,
                {
                    x:303,
                    y:710,
                    size:10
                }
            );
            page.drawText
            (
                t1s,
                {
                    x:303,
                    y:698,
                    size:10
                }
            );
            page.drawText
            (
                t2s,
                {
                    x:303,
                    y:683,
                    size:10
                }
            );
            page.drawText
            (
                result,
                {
                    x:303,
                    y:670,
                    size:10
                }
            );
            let prmToSave=pdfDoc.save();
            prmToSave.then
            (
                function(changedBytes)
                {
                    //since greater than 1 match between two teams but scorecards should not overlap
                    if(fs.existsSync(matchFileName+".pdf")==true)//existsSync checks if folder already present,true means folder already present
                    {
                        fs.writeFileSync(matchFileName+"1.pdf",changedBytes);//example: if india.pdf is present, india1.pdf is made and india.pdf is not overwritten
                    }
                    else
                    {
                        fs.writeFileSync(matchFileName+".pdf",changedBytes);
                    }   
                }
            )
            .catch
            (
                function(err)
                {
                    console.log(err);
                }
            );
        }
    )
    .catch
    (
        function(err)
        {
            console.log(err);
        }
    );
}

function createExcel(teams,excelFileName)//similar to code of excel.js created previously
{
    let wb=new excel.Workbook();
    let hstyle=wb.createStyle(
        {
            font:{
                bold:true,
                color:"red",
                underline:true,
                size:15
            },
            fill:{
                type:"pattern",
                patternType:"solid",
                fgColor:"yellow"
            }
        }
    );
    for(let i=0;i<teams.length;i++)
    {
        let sheet=wb.addWorksheet(teams[i].name);
        sheet.cell(1,1).string("VS").style(hstyle);
        sheet.cell(1,2).string("Self Score").style(hstyle);
        sheet.cell(1,3).string("Opp Score").style(hstyle);
        sheet.cell(1,4).string("Result").style(hstyle);
        for(let j=0;j<teams[i].matches.length;j++)
        {
            let vs=teams[i].matches[j].vs;
            let selfScore=teams[i].matches[j].selfScore;
            let oppScore=teams[i].matches[j].oppScore;
            let result=teams[i].matches[j].result;
            sheet.cell(2+j,1).string(vs);
            sheet.cell(2+j,2).string(selfScore);
            sheet.cell(2+j,3).string(oppScore);
            sheet.cell(2+j,4).string(result);
        }
    }
    wb.write(excelFileName);
}

function populateTeams(teams,match)
{
   //for team1
   let t1idx=-1;//say
   for(let i=0;i<teams.length;i++)//loop in teams array
   {
       if(teams[i].name==match.t1)//check if team name is equal to t1
       {
           t1idx=i;//team name found at i
           break;
       }
   }
   if(t1idx==-1)//team name not found
   {
       let team=//object
       {
           name:match.t1,//add team name to teams array
           matches:[]
       };
       teams.push(team);
   }
   
   
   //similarly for team2
   let t2idx=-1;//say
   for(let i=0;i<teams.length;i++)//loop in teams array
   {
       if(teams[i].name==match.t2)//check if team name is equal to t2
       {
           t2idx=i;//team name found at i
           break;
       }
   }
   if(t2idx==-1)//team name not found
   {
       let team=//object
       {
           name:match.t2,//add team name to teams array
           matches:[]
       };
       teams.push(team);
   }
}

function populateMatchesInTeam(teams,match)
{
    //for team1
    let t1idx=-1;//say
    for(let i=0;i<teams.length;i++)//loop in teams array
    {
       if(teams[i].name==match.t1)//check if team name is equal to t1
       {
           t1idx=i;//team name found at i
           break;
       }
    }

    //we wont check if t1idx =-1 because all the teams are present

    let match1=//object
    {
        vs:match.t2,
        selfScore:match.t1s,
        oppScore:match.t2s,
        result:match.result
    };
    teams[t1idx].matches.push(match1);

    //similarly for team2
    let t2idx=-1;//say
    for(let i=0;i<teams.length;i++)//loop in teams array
    {
       if(teams[i].name==match.t2)//check if team name is equal to t1
       {
           t2idx=i;//team name found at i
           break;
       }
    }

    //we wont check if t1idx =-1 because all the teams are present

    let match2=//object
    {
        vs:match.t1,
        selfScore:match.t2s,
        oppScore:match.t1s,
        result:match.result
    };
    teams[t2idx].matches.push(match2);
}