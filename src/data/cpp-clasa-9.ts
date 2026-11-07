// Programa C++ clasa a IX-a, matematică-informatică intensiv (ordinea pbinfo.ro).
export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  points: string[];
  code?: string;
  pitfall?: string;
}
export interface Chapter {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export const CPP_C9: Chapter[] = [
  {
    id: "introducere",
    title: "Noțiuni introductive în C++",
    description: "Primul program, vocabularul limbajului, tipuri de date, citire și afișare.",
    lessons: [
      {
        slug: "structura-programului",
        title: "Structura unui program C++",
        summary: "Orice program C++ are directive de preprocesare, declarații și funcția principală main.",
        points: [
          "#include <iostream> include biblioteca pentru citire/afișare.",
          "using namespace std; permite scrierea cout în loc de std::cout.",
          "Execuția începe în funcția int main() și se termină la return 0;.",
          "Fiecare instrucțiune se încheie cu ;, iar blocurile se delimitează cu { }.",
        ],
        code: `#include <iostream>
using namespace std;

int main() {
    cout << "Salut, Cantemir!";
    return 0;
}`,
      },
      {
        slug: "vocabular",
        title: "Vocabularul limbajului",
        summary: "Setul de caractere, identificatorii, cuvintele cheie, separatorii și comentariile.",
        points: [
          "Identificatorii încep cu literă sau _ și conțin litere, cifre, _.",
          "C++ face diferența între litere mari și mici: suma ≠ Suma.",
          "Cuvintele cheie (int, if, while, return…) nu pot fi folosite ca nume.",
          "Comentarii: // pe o linie și /* ... */ pe mai multe linii.",
        ],
        code: `// comentariu pe o linie
/* comentariu
   pe mai multe linii */
int nrElevi = 30; // identificator valid`,
      },
      {
        slug: "tipuri-de-date",
        title: "Tipuri de date simple",
        summary: "Tipul unei date stabilește valorile posibile, memoria ocupată și operațiile permise.",
        points: [
          "int: întregi pe 4 octeți (aprox. ±2·10⁹).",
          "long long: întregi pe 8 octeți (aprox. ±9·10¹⁸).",
          "float / double: numere reale (double are precizie mai mare).",
          "char: un caracter (cod ASCII); bool: true / false.",
        ],
        code: `int n = 2000000000;
long long mare = 9000000000000LL;
double pi = 3.14159;
char c = 'A';
bool ok = true;`,
        pitfall: "Depășirea limitei int dă rezultate greșite fără nicio eroare — folosește long long la produse mari.",
      },
      {
        slug: "variabile-constante",
        title: "Variabile și constante",
        summary: "Variabila este o zonă de memorie cu nume, tip și valoare; constanta nu își poate schimba valoarea.",
        points: [
          "Declarare: tip nume; sau tip nume = valoare_initiala;",
          "Se pot declara mai multe variabile: int a, b = 5, c;",
          "Constantele simbolice: const int NMAX = 1000;",
          "Variabilele locale neinițializate conțin valori aleatoare.",
        ],
        code: `const double G = 9.81;
int a, b = 5;
a = b * 2;`,
      },
      {
        slug: "citire-afisare",
        title: "Citirea și afișarea datelor",
        summary: "Fluxurile cin și cout realizează citirea de la tastatură și afișarea pe ecran.",
        points: [
          "cin >> a >> b; citește valori separate prin spații sau Enter.",
          "cout << a << ' ' << b; afișează valori succesive.",
          "endl sau '\\n' trec la linie nouă.",
          "Fișiere: #include <fstream>, ifstream fin(\"date.in\"); ofstream fout(\"date.out\");",
        ],
        code: `int a, b;
cin >> a >> b;
cout << "Suma este " << a + b << '\\n';`,
      },
    ],
  },
  {
    id: "operatori",
    title: "Operatori și expresii",
    description: "Cum se construiesc și se evaluează expresiile în C++.",
    lessons: [
      {
        slug: "operatori-aritmetici",
        title: "Operatori aritmetici",
        summary: "Operatorii +, -, *, /, % lucrează cu valori numerice.",
        points: [
          "Între doi întregi, / face împărțire întreagă: 7 / 2 = 3.",
          "% (modulo) dă restul împărțirii și se aplică doar întregilor: 7 % 2 = 1.",
          "n % 10 = ultima cifră; n / 10 = numărul fără ultima cifră.",
          "Dacă cel puțin un operand e real, rezultatul e real: 7.0 / 2 = 3.5.",
        ],
        code: `int n = 1234;
cout << n % 10;  // 4
cout << n / 10;  // 123`,
        pitfall: "Media a două numere întregi: (a + b) / 2.0, nu (a + b) / 2.",
      },
      {
        slug: "atribuire-incrementare",
        title: "Atribuire, atribuire compusă, incrementare",
        summary: "Operatorul = copiază o valoare într-o variabilă; există forme prescurtate.",
        points: [
          "x += 3 înseamnă x = x + 3 (analog -=, *=, /=, %=).",
          "++x crește x apoi folosește valoarea; x++ folosește valoarea apoi crește.",
          "Atribuirea multiplă: a = b = 0;",
        ],
        code: `int x = 5;
int y = x++; // y = 5, x = 6
int z = ++x; // z = 7, x = 7`,
      },
      {
        slug: "operatori-relationali",
        title: "Operatori relaționali și de egalitate",
        summary: "Compară două valori și produc rezultat logic (1 = adevărat, 0 = fals).",
        points: [
          "<, <=, >, >= compară ordinea.",
          "== testează egalitatea, != diferența.",
          "Rezultatul poate fi folosit direct în calcule: (a > b) valorează 0 sau 1.",
        ],
        code: `if (a == b) cout << "egale";`,
        pitfall: "if (a = b) este o atribuire, nu o comparație! Folosește ==.",
      },
      {
        slug: "operatori-logici",
        title: "Operatori logici",
        summary: "&& (ȘI), || (SAU), ! (NEGAȚIE) combină condiții.",
        points: [
          "a && b este adevărat doar dacă ambele sunt adevărate.",
          "a || b este adevărat dacă cel puțin una este adevărată.",
          "Evaluare scurtcircuitată: la && se oprește la primul fals.",
          "Legile lui De Morgan: !(a && b) == !a || !b.",
        ],
        code: `if (x >= 1 && x <= 10) cout << "x in [1,10]";
if (n % 2 == 0 || n % 5 == 0) cout << "par sau multiplu de 5";`,
      },
      {
        slug: "conversii",
        title: "Conversii de tip",
        summary: "Valorile se pot converti implicit (automat) sau explicit (cast).",
        points: [
          "La atribuirea unui real într-un int, partea zecimală se pierde.",
          "Cast explicit: (double)a / b sau double(a) / b.",
          "char se convertește la codul său ASCII: 'A' + 1 = 66.",
        ],
        code: `int a = 7, b = 2;
double r = (double)a / b; // 3.5
char c = 'a' + 2;          // 'c'`,
      },
      {
        slug: "prioritate",
        title: "Prioritatea operatorilor",
        summary: "Ordinea în care se evaluează operatorii dintr-o expresie.",
        points: [
          "Ordine (descrescător): !, ++, -- → *, /, % → +, - → <, <=, >, >= → ==, != → && → || → =.",
          "Parantezele schimbă ordinea și cresc lizibilitatea.",
          "Operatorii cu aceeași prioritate se evaluează de la stânga la dreapta (excepție: atribuirea).",
        ],
        code: `int r = 2 + 3 * 4;     // 14
int s = (2 + 3) * 4;   // 20`,
      },
    ],
  },
  {
    id: "structuri-control",
    title: "Structuri de control",
    description: "Structura alternativă și structurile repetitive.",
    lessons: [
      {
        slug: "if-else",
        title: "Instrucțiunea if",
        summary: "Execută instrucțiuni diferite în funcție de valoarea unei condiții.",
        points: [
          "if (conditie) instr1; else instr2; — ramura else este opțională.",
          "Mai multe instrucțiuni pe o ramură se grupează în { }.",
          "Operatorul ternar: max = (a > b) ? a : b;",
        ],
        code: `if (n % 2 == 0)
    cout << "par";
else
    cout << "impar";`,
      },
      {
        slug: "switch",
        title: "Instrucțiunea switch",
        summary: "Selecție multiplă după valoarea unei expresii întregi.",
        points: [
          "Fiecare case se încheie de obicei cu break;.",
          "default se execută când nicio valoare nu se potrivește.",
          "Fără break, execuția continuă în cazul următor.",
        ],
        code: `switch (zi) {
    case 6: case 7: cout << "weekend"; break;
    default: cout << "zi lucratoare";
}`,
      },
      {
        slug: "while",
        title: "Instrucțiunea while",
        summary: "Structură repetitivă cu test inițial: condiția se verifică înainte de fiecare pas.",
        points: [
          "Dacă condiția e falsă de la început, corpul nu se execută deloc.",
          "Corpul trebuie să modifice condiția, altfel ciclul este infinit.",
        ],
        code: `while (n > 0) {
    s += n % 10;
    n /= 10;
}`,
      },
      {
        slug: "do-while",
        title: "Instrucțiunea do-while",
        summary: "Structură repetitivă cu test final: corpul se execută cel puțin o dată.",
        points: [
          "Sintaxă: do { ... } while (conditie);",
          "Util la validarea datelor citite.",
        ],
        code: `do {
    cin >> n;
} while (n <= 0);`,
      },
      {
        slug: "for",
        title: "Instrucțiunea for",
        summary: "Structură repetitivă folosită de obicei când numărul de pași este cunoscut.",
        points: [
          "for (initializare; conditie; pas) instructiune;",
          "Echivalent cu un while scris compact.",
          "Variabila contor poate fi declarată în for: for (int i = 1; i <= n; i++).",
        ],
        code: `int s = 0;
for (int i = 1; i <= n; i++)
    s += i;`,
      },
      {
        slug: "break-continue",
        title: "Instrucțiunile break și continue",
        summary: "Controlează execuția din interiorul structurilor repetitive.",
        points: [
          "break părăsește imediat ciclul curent.",
          "continue sare la pasul următor al ciclului.",
          "Folosește-le cu moderație pentru cod clar.",
        ],
        code: `for (int i = 1; i <= n; i++) {
    if (i % 3 == 0) continue;
    if (i > 100) break;
    cout << i << ' ';
}`,
      },
    ],
  },
  {
    id: "algoritmi-elementari",
    title: "Algoritmi elementari",
    description: "Cifre, divizibilitate, numere prime, cmmdc, baze de numerație, șiruri.",
    lessons: [
      {
        slug: "cifrele-unui-numar",
        title: "Prelucrarea cifrelor unui număr",
        summary: "Cifrele se extrag de la dreapta la stânga cu % 10 și / 10.",
        points: [
          "Număr de cifre, suma cifrelor, cifra maximă, cifre pare.",
          "Cazul n = 0 trebuie tratat separat (are o cifră).",
        ],
        code: `int nr = 0, s = 0;
do {
    s += n % 10;
    nr++;
    n /= 10;
} while (n > 0);`,
      },
      {
        slug: "oglindit-palindrom",
        title: "Oglinditul și palindromul",
        summary: "Oglinditul se construiește adăugând câte o cifră la dreapta: og = og * 10 + cifra.",
        points: [
          "Un număr este palindrom dacă este egal cu oglinditul său.",
          "Păstrează o copie a lui n, deoarece n se distruge în ciclu.",
        ],
        code: `int copie = n, og = 0;
while (n > 0) {
    og = og * 10 + n % 10;
    n /= 10;
}
if (og == copie) cout << "palindrom";`,
      },
      {
        slug: "divizori",
        title: "Divizorii unui număr",
        summary: "Determinarea, numărarea și însumarea divizorilor.",
        points: [
          "Varianta simplă: d de la 1 la n.",
          "Varianta eficientă: d până la √n, divizorii vin în perechi (d, n/d).",
          "Atenție la pătratele perfecte: d == n/d se numără o singură dată.",
        ],
        code: `int nr = 0;
for (int d = 1; d * d <= n; d++)
    if (n % d == 0) {
        nr++;
        if (d != n / d) nr++;
    }`,
      },
      {
        slug: "numar-prim",
        title: "Testarea primalității",
        summary: "Un număr este prim dacă are exact doi divizori: 1 și el însuși.",
        points: [
          "0 și 1 nu sunt prime; 2 este singurul număr prim par.",
          "Este suficient să căutăm divizori până la √n.",
        ],
        code: `bool prim = n >= 2;
for (int d = 2; d * d <= n && prim; d++)
    if (n % d == 0) prim = false;`,
      },
      {
        slug: "cmmdc",
        title: "Cel mai mare divizor comun (Euclid)",
        summary: "Algoritmul lui Euclid prin împărțiri repetate: cmmdc(a, b) = cmmdc(b, a % b).",
        points: [
          "Se oprește când restul devine 0; cmmdc-ul este ultimul rest nenul.",
          "Varianta prin scăderi: se scade numărul mai mic din cel mai mare.",
          "Numerele sunt prime între ele dacă cmmdc = 1.",
        ],
        code: `while (b != 0) {
    int r = a % b;
    a = b;
    b = r;
}
cout << a;`,
      },
      {
        slug: "cmmmc",
        title: "Cel mai mic multiplu comun",
        summary: "cmmmc(a, b) = a · b / cmmdc(a, b).",
        points: [
          "Calculează mai întâi cmmdc pe copii ale numerelor.",
          "Pentru a evita depășirea: a / cmmdc * b.",
        ],
        code: `long long cmmmc = (long long)x / cmmdc * y;`,
      },
      {
        slug: "baze-numeratie",
        title: "Baze de numerație",
        summary: "Conversia din baza 10 în baza b prin împărțiri repetate și invers prin sumă de puteri.",
        points: [
          "10 → 2: resturile împărțirii la 2 citite de jos în sus.",
          "2 → 10: fiecare cifră se înmulțește cu puterea corespunzătoare a lui 2.",
          "Construirea rezultatului ca număr: rez += cifra * p; p *= 10;",
        ],
        code: `long long rez = 0, p = 1;
while (n > 0) {
    rez += (n % 2) * p;
    p *= 10;
    n /= 2;
}`,
      },
      {
        slug: "fibonacci",
        title: "Șirul lui Fibonacci și șiruri recurente",
        summary: "F₁ = F₂ = 1, Fₙ = Fₙ₋₁ + Fₙ₋₂. Se calculează cu trei variabile, fără vectori.",
        points: [
          "Generarea primilor n termeni sau a termenilor mai mici decât o valoare.",
          "Termenii cresc rapid — folosește long long.",
        ],
        code: `long long a = 1, b = 1;
for (int i = 3; i <= n; i++) {
    long long c = a + b;
    a = b;
    b = c;
}`,
      },
      {
        slug: "secvente-valori",
        title: "Prelucrarea secvențelor de valori",
        summary: "Citirea succesivă a n numere și determinarea min/max, sume, numărări.",
        points: [
          "Minimul se inițializează cu prima valoare citită (sau cu o valoare foarte mare).",
          "Verificarea că toate valorile au o proprietate: se folosește o variabilă bool.",
          "Secvențe terminate cu 0: citire în while.",
        ],
        code: `int n, x, mx;
cin >> n >> x;
mx = x;
for (int i = 2; i <= n; i++) {
    cin >> x;
    if (x > mx) mx = x;
}`,
      },
    ],
  },
  {
    id: "vectori",
    title: "Tablouri unidimensionale (vectori)",
    description: "Memorarea și prelucrarea șirurilor de valori — specific profilului intensiv.",
    lessons: [
      {
        slug: "declarare-vectori",
        title: "Declararea și parcurgerea vectorilor",
        summary: "Un vector memorează mai multe valori de același tip, accesate prin indice.",
        points: [
          "Declarare: int v[1001]; — dimensiunea este o constantă.",
          "Indicii încep de la 0; des folosim elementele 1..n.",
          "Vectorii globali sunt inițializați automat cu 0.",
        ],
        code: `int v[1001], n;
cin >> n;
for (int i = 1; i <= n; i++) cin >> v[i];
for (int i = 1; i <= n; i++) cout << v[i] << ' ';`,
        pitfall: "Accesarea unui indice în afara dimensiunii nu dă eroare de compilare, dar strică programul.",
      },
      {
        slug: "prelucrari-vectori",
        title: "Prelucrări simple în vectori",
        summary: "Sume, numărări, minim/maxim și poziția lor, verificarea unor proprietăți.",
        points: [
          "Poziția primului/ultimului maxim: > față de >= în comparație.",
          "Inversarea vectorului: interschimbare v[i] cu v[n-i+1] până la mijloc.",
        ],
        code: `int pmax = 1;
for (int i = 2; i <= n; i++)
    if (v[i] > v[pmax]) pmax = i;`,
      },
      {
        slug: "inserare",
        title: "Inserarea unui element",
        summary: "Elementele de la poziția p se mută cu o poziție la dreapta, apoi se pune noua valoare.",
        points: [
          "Mutarea se face de la final spre p, ca să nu se suprascrie valorile.",
          "n crește cu 1.",
        ],
        code: `for (int i = n; i >= p; i--) v[i + 1] = v[i];
v[p] = x;
n++;`,
      },
      {
        slug: "stergere",
        title: "Ștergerea unui element",
        summary: "Elementele de după poziția p se mută cu o poziție la stânga.",
        points: [
          "Mutarea se face de la p spre final.",
          "La ștergerea mai multor elemente, după ștergere nu crește i.",
        ],
        code: `for (int i = p; i < n; i++) v[i] = v[i + 1];
n--;`,
      },
      {
        slug: "cautare",
        title: "Căutarea secvențială și căutarea binară",
        summary: "Secvențial: verificăm fiecare element. Binar: împărțim intervalul în jumătăți (vector sortat).",
        points: [
          "Căutarea secvențială are complexitate O(n).",
          "Căutarea binară are complexitate O(log n), dar cere vector ordonat.",
        ],
        code: `int st = 1, dr = n, poz = -1;
while (st <= dr && poz == -1) {
    int m = (st + dr) / 2;
    if (v[m] == x) poz = m;
    else if (v[m] < x) st = m + 1;
    else dr = m - 1;
}`,
      },
      {
        slug: "bubble-sort",
        title: "Sortarea prin metoda bulelor",
        summary: "Se compară elementele vecine și se interschimbă până când nu mai apar inversiuni.",
        points: [
          "O variabilă bool reține dacă la ultima parcurgere s-a făcut o interschimbare.",
          "Complexitate O(n²) în cazul cel mai defavorabil.",
        ],
        code: `bool sortat;
do {
    sortat = true;
    for (int i = 1; i < n; i++)
        if (v[i] > v[i + 1]) {
            swap(v[i], v[i + 1]);
            sortat = false;
        }
} while (!sortat);`,
      },
      {
        slug: "sortare-selectie",
        title: "Sortarea prin selecție",
        summary: "Pentru fiecare poziție i se alege minimul din v[i..n] și se pune pe poziția i.",
        points: [
          "Varianta simplă: comparăm v[i] cu fiecare v[j], j > i.",
          "Complexitate O(n²).",
        ],
        code: `for (int i = 1; i < n; i++)
    for (int j = i + 1; j <= n; j++)
        if (v[i] > v[j]) swap(v[i], v[j]);`,
      },
      {
        slug: "sortare-numarare",
        title: "Sortarea prin numărare",
        summary: "Pentru valori naturale mici, numărăm de câte ori apare fiecare valoare (vector de frecvență).",
        points: [
          "fr[x]++ pentru fiecare valoare citită.",
          "Se afișează fiecare valoare de câte ori a apărut.",
          "Complexitate O(n + valmax).",
        ],
        code: `int fr[1001] = {0};
for (int i = 1; i <= n; i++) fr[v[i]]++;
for (int x = 0; x <= 1000; x++)
    for (int k = 1; k <= fr[x]; k++) cout << x << ' ';`,
      },
      {
        slug: "interclasare",
        title: "Interclasarea a doi vectori",
        summary: "Din doi vectori sortați se obține un al treilea vector sortat, într-o singură parcurgere.",
        points: [
          "Se compară elementele curente și se copiază cel mai mic.",
          "La final se copiază elementele rămase din vectorul neterminat.",
          "Complexitate O(n + m).",
        ],
        code: `int i = 1, j = 1, k = 0;
while (i <= n && j <= m)
    if (a[i] < b[j]) c[++k] = a[i++];
    else c[++k] = b[j++];
while (i <= n) c[++k] = a[i++];
while (j <= m) c[++k] = b[j++];`,
      },
    ],
  },
];

export const ALL_LESSONS = CPP_C9.flatMap((ch) => ch.lessons.map((l) => ({ ...l, chapter: ch })));
