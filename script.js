const lettersInput=document.getElementById("letters");
const findButton=document.getElementById("findButton");
const clearButton=document.getElementById("clearButton");
const statusBox=document.getElementById("status");
const filtersBox=document.getElementById("filters");
const resultsList=document.getElementById("results");
const dictionaryCount=document.getElementById("dictionaryCount");
const filterButtons=[...document.querySelectorAll(".filter-button")];
const year=document.getElementById("year");

const WORDS=Array.isArray(window.KELIME_LISTESI)?window.KELIME_LISTESI:[];
let currentMatches=[];
let activeFilter="all";

year.textContent=new Date().getFullYear();
dictionaryCount.textContent=`${WORDS.length.toLocaleString("tr-TR")} kelime`;

function normalizeTurkish(value){
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/g,"");
}

function countLetters(text){
  const counts=new Map();
  for(const ch of text){
    counts.set(ch,(counts.get(ch)||0)+1);
  }
  return counts;
}

function canBuildWord(word,available){
  const used=new Map();
  for(const ch of word){
    const next=(used.get(ch)||0)+1;
    if(next>(available.get(ch)||0)) return false;
    used.set(ch,next);
  }
  return true;
}

function matchesFilter(word){
  if(activeFilter==="3") return word.length===3;
  if(activeFilter==="4") return word.length===4;
  if(activeFilter==="5plus") return word.length>=5;
  return true;
}

function updateFilterButtons(){
  for(const button of filterButtons){
    button.classList.toggle("active",button.dataset.filter===activeFilter);
  }
}

function renderResults(){
  resultsList.innerHTML="";
  const filtered=currentMatches.filter(matchesFilter);
  const visible=filtered.slice(0,500);

  if(currentMatches.length===0){
    statusBox.textContent="Bu harflerle uygun kelime bulunamadı.";
    filtersBox.classList.remove("visible");
    return;
  }

  filtersBox.classList.add("visible");

  if(activeFilter==="all"){
    statusBox.textContent=`${currentMatches.length.toLocaleString("tr-TR")} kelime bulundu.`;
  }else{
    statusBox.textContent=
      `Toplam ${currentMatches.length.toLocaleString("tr-TR")} kelime bulundu; `+
      `${filtered.length.toLocaleString("tr-TR")} tanesi bu filtreye uyuyor.`;
  }

  for(const word of visible){
    const item=document.createElement("li");
    const wordText=document.createElement("span");
    const lengthText=document.createElement("span");

    wordText.textContent=word.toLocaleUpperCase("tr-TR");
    lengthText.className="word-length";
    lengthText.textContent=`${word.length} harf`;

    item.append(wordText,lengthText);
    resultsList.appendChild(item);
  }
}

function findWords(){
  const letters=normalizeTurkish(lettersInput.value);

  if(WORDS.length===0){
    statusBox.textContent="Kelime verisi yüklenemedi.";
    return;
  }

  if(letters.length<3){
    statusBox.textContent="En az 3 harf yazmalısın.";
    filtersBox.classList.remove("visible");
    resultsList.innerHTML="";
    return;
  }

  const counts=countLetters(letters);

  currentMatches=WORDS
    .filter(word=>word.length>=3&&word.length<=letters.length)
    .filter(word=>canBuildWord(word,counts))
    .sort((a,b)=>b.length-a.length||a.localeCompare(b,"tr-TR"));

  activeFilter="all";
  updateFilterButtons();
  renderResults();
}

function clearTool(){
  lettersInput.value="";
  currentMatches=[];
  activeFilter="all";
  statusBox.textContent="";
  resultsList.innerHTML="";
  filtersBox.classList.remove("visible");
  updateFilterButtons();
  lettersInput.focus();
}

findButton.addEventListener("click",findWords);
clearButton.addEventListener("click",clearTool);

lettersInput.addEventListener("keydown",event=>{
  if(event.key==="Enter") findWords();
});

for(const button of filterButtons){
  button.addEventListener("click",()=>{
    activeFilter=button.dataset.filter;
    updateFilterButtons();
    renderResults();
  });
}
