/**
 * destiny-chart-utils.ts
 * Pure bazi (八字) algorithm functions and chart data builders.
 * Extracted for the 人生数据看板 React conversion.
 */

/* ══════ Constants ══════ */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const S_EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
export const B_EL = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
export const EL = ['木', '火', '土', '金', '水'] as const;
export type Element = (typeof EL)[number];

export const EC: Record<string, string> = {
    '木': '#16a34a',
    '火': '#dc2626',
    '土': '#d97706',
    '金': '#ca8a04',
    '水': '#2563eb'
};
export const EA: Record<string, {color: string; dir: string; ind: string}> = {
    '木': {color: '绿色系', dir: '东方', ind: '教育、出版、内容、农林、生长型行业'},
    '火': {color: '红/紫色系', dir: '南方', ind: '传媒、品牌、演艺、科技、能源行业'},
    '土': {color: '黄/棕色系', dir: '本地', ind: '地产、农业、咨询、仓储、服务型行业'},
    '金': {color: '白/银色系', dir: '西方', ind: '金融、法律、机械、制造、精密型行业'},
    '水': {color: '黑/蓝色系', dir: '北方', ind: '物流、贸易、研究、IT、创意型行业'}
};

const MONTH_STEM_BASE = [2, 4, 6, 8, 0];
const HOUR_STEM_BASE = [0, 2, 4, 6, 8];

export const HIDDEN_STEMS: Record<string, [number, number][]> = {
    '子': [[9, 1.0]],
    '丑': [
        [5, 0.6],
        [9, 0.2],
        [7, 0.2]
    ],
    '寅': [
        [0, 0.6],
        [2, 0.2],
        [4, 0.2]
    ],
    '卯': [[1, 1.0]],
    '辰': [
        [4, 0.6],
        [1, 0.2],
        [9, 0.2]
    ],
    '巳': [
        [2, 0.6],
        [6, 0.2],
        [4, 0.2]
    ],
    '午': [
        [3, 0.6],
        [5, 0.4]
    ],
    '未': [
        [5, 0.6],
        [3, 0.2],
        [1, 0.2]
    ],
    '申': [
        [6, 0.6],
        [8, 0.2],
        [4, 0.2]
    ],
    '酉': [[7, 1.0]],
    '戌': [
        [4, 0.6],
        [7, 0.2],
        [3, 0.2]
    ],
    '亥': [
        [8, 0.6],
        [0, 0.4]
    ]
};

export const GEN_MAP: Record<string, string> = {'木': '火', '火': '土', '土': '金', '金': '水', '水': '木'};
export const CTRL_MAP: Record<string, string> = {'木': '土', '火': '金', '土': '水', '金': '木', '水': '火'};

const JIE_TABLE: [number, number][] = [
    [1, 6],
    [2, 4],
    [3, 6],
    [4, 5],
    [5, 6],
    [6, 6],
    [7, 7],
    [8, 7],
    [9, 8],
    [10, 8],
    [11, 7],
    [12, 7]
];
const JIE_BRANCH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

/* ══════ Province / City data ══════ */
export const PROV_CITIES: [string, [string, number][]][] = [
    ['北京', [['北京', 116.4]]],
    ['天津', [['天津', 117.2]]],
    ['上海', [['上海', 121.5]]],
    ['重庆', [['重庆', 106.5]]],
    [
        '河北',
        [
            ['石家庄', 114.5],
            ['唐山', 118.2],
            ['秦皇岛', 119.6],
            ['邯郸', 114.5],
            ['邢台', 114.5],
            ['保定', 115.5],
            ['张家口', 114.9],
            ['承德', 117.9],
            ['沧州', 116.9],
            ['廊坊', 116.7],
            ['衡水', 115.7]
        ]
    ],
    [
        '山西',
        [
            ['太原', 112.5],
            ['大同', 113.3],
            ['阳泉', 113.6],
            ['长治', 113.1],
            ['晋城', 112.8],
            ['朔州', 112.4],
            ['晋中', 112.7],
            ['运城', 111.0],
            ['忻州', 112.7],
            ['临汾', 111.5],
            ['吕梁', 111.1]
        ]
    ],
    [
        '内蒙古',
        [
            ['呼和浩特', 111.7],
            ['包头', 110.0],
            ['乌海', 106.8],
            ['赤峰', 118.9],
            ['通辽', 122.3],
            ['鄂尔多斯', 109.8],
            ['呼伦贝尔', 119.8],
            ['巴彦淖尔', 107.4],
            ['乌兰察布', 113.1],
            ['兴安盟', 122.1],
            ['锡林郭勒', 116.1],
            ['阿拉善', 105.7]
        ]
    ],
    [
        '辽宁',
        [
            ['沈阳', 123.4],
            ['大连', 121.6],
            ['鞍山', 123.0],
            ['抚顺', 123.9],
            ['本溪', 123.8],
            ['丹东', 124.4],
            ['锦州', 121.1],
            ['营口', 122.2],
            ['阜新', 121.7],
            ['辽阳', 123.2],
            ['盘锦', 122.1],
            ['铁岭', 123.8],
            ['朝阳', 120.5],
            ['葫芦岛', 120.8]
        ]
    ],
    [
        '吉林',
        [
            ['长春', 125.3],
            ['吉林', 126.6],
            ['四平', 124.4],
            ['辽源', 125.1],
            ['通化', 125.9],
            ['白山', 126.4],
            ['松原', 124.8],
            ['白城', 122.8],
            ['延边', 129.5]
        ]
    ],
    [
        '黑龙江',
        [
            ['哈尔滨', 126.6],
            ['齐齐哈尔', 124.0],
            ['鸡西', 130.9],
            ['鹤岗', 130.3],
            ['双鸭山', 131.2],
            ['大庆', 125.0],
            ['伊春', 128.9],
            ['佳木斯', 130.4],
            ['七台河', 131.0],
            ['牡丹江', 129.6],
            ['黑河', 127.5],
            ['绥化', 127.0],
            ['大兴安岭', 124.1]
        ]
    ],
    [
        '江苏',
        [
            ['南京', 118.8],
            ['无锡', 120.3],
            ['徐州', 117.2],
            ['常州', 119.9],
            ['苏州', 120.6],
            ['南通', 120.9],
            ['连云港', 119.2],
            ['淮安', 119.0],
            ['盐城', 120.1],
            ['扬州', 119.4],
            ['镇江', 119.4],
            ['泰州', 119.9],
            ['宿迁', 118.3]
        ]
    ],
    [
        '浙江',
        [
            ['杭州', 120.2],
            ['宁波', 121.5],
            ['温州', 120.7],
            ['嘉兴', 120.8],
            ['湖州', 120.1],
            ['绍兴', 120.6],
            ['金华', 119.6],
            ['衢州', 118.9],
            ['舟山', 122.1],
            ['台州', 121.4],
            ['丽水', 119.9]
        ]
    ],
    [
        '安徽',
        [
            ['合肥', 117.3],
            ['芜湖', 118.4],
            ['蚌埠', 117.4],
            ['淮南', 117.0],
            ['马鞍山', 118.5],
            ['淮北', 116.8],
            ['铜陵', 117.8],
            ['安庆', 117.1],
            ['黄山', 118.3],
            ['滁州', 118.3],
            ['阜阳', 115.8],
            ['宿州', 116.9],
            ['六安', 116.5],
            ['亳州', 115.8],
            ['池州', 117.5],
            ['宣城', 118.8]
        ]
    ],
    [
        '福建',
        [
            ['福州', 119.3],
            ['厦门', 118.1],
            ['莆田', 119.0],
            ['三明', 117.6],
            ['泉州', 118.6],
            ['漳州', 117.6],
            ['南平', 118.2],
            ['龙岩', 117.0],
            ['宁德', 119.5]
        ]
    ],
    [
        '江西',
        [
            ['南昌', 115.9],
            ['景德镇', 117.2],
            ['萍乡', 113.9],
            ['九江', 116.0],
            ['新余', 114.9],
            ['鹰潭', 117.1],
            ['赣州', 114.9],
            ['吉安', 115.0],
            ['宜春', 114.4],
            ['抚州', 116.4],
            ['上饶', 117.9]
        ]
    ],
    [
        '山东',
        [
            ['济南', 117.0],
            ['青岛', 120.4],
            ['淄博', 118.1],
            ['枣庄', 117.3],
            ['东营', 118.5],
            ['烟台', 121.4],
            ['潍坊', 119.1],
            ['济宁', 116.6],
            ['泰安', 117.1],
            ['威海', 122.1],
            ['日照', 119.5],
            ['临沂', 118.3],
            ['德州', 116.4],
            ['聊城', 116.0],
            ['滨州', 118.0],
            ['菏泽', 115.4]
        ]
    ],
    [
        '河南',
        [
            ['郑州', 113.6],
            ['开封', 114.3],
            ['洛阳', 112.4],
            ['平顶山', 113.2],
            ['安阳', 114.4],
            ['鹤壁', 114.3],
            ['新乡', 113.9],
            ['焦作', 113.2],
            ['濮阳', 115.0],
            ['许昌', 113.9],
            ['漯河', 114.0],
            ['三门峡', 111.2],
            ['南阳', 112.5],
            ['商丘', 115.7],
            ['信阳', 114.1],
            ['周口', 114.6],
            ['驻马店', 114.0]
        ]
    ],
    [
        '湖北',
        [
            ['武汉', 114.3],
            ['黄石', 115.0],
            ['十堰', 110.8],
            ['宜昌', 111.3],
            ['襄阳', 112.1],
            ['鄂州', 114.9],
            ['荆门', 112.2],
            ['孝感', 113.9],
            ['荆州', 112.2],
            ['黄冈', 114.9],
            ['咸宁', 114.3],
            ['随州', 113.4],
            ['恩施', 109.5]
        ]
    ],
    [
        '湖南',
        [
            ['长沙', 113.0],
            ['株洲', 113.1],
            ['湘潭', 112.9],
            ['衡阳', 112.6],
            ['邵阳', 111.5],
            ['岳阳', 113.1],
            ['常德', 111.7],
            ['张家界', 110.5],
            ['益阳', 112.4],
            ['郴州', 113.0],
            ['永州', 111.6],
            ['怀化', 110.0],
            ['娄底', 112.0],
            ['湘西', 109.7]
        ]
    ],
    [
        '广东',
        [
            ['广州', 113.3],
            ['韶关', 113.6],
            ['深圳', 114.1],
            ['珠海', 113.6],
            ['汕头', 116.7],
            ['佛山', 113.1],
            ['江门', 113.1],
            ['湛江', 110.4],
            ['茂名', 110.9],
            ['肇庆', 112.5],
            ['惠州', 114.4],
            ['梅州', 116.1],
            ['汕尾', 115.4],
            ['河源', 114.7],
            ['阳江', 111.9],
            ['清远', 113.1],
            ['东莞', 113.7],
            ['中山', 113.4],
            ['潮州', 116.6],
            ['揭阳', 116.4],
            ['云浮', 112.0]
        ]
    ],
    [
        '广西',
        [
            ['南宁', 108.4],
            ['柳州', 109.4],
            ['桂林', 110.3],
            ['梧州', 111.3],
            ['北海', 109.1],
            ['防城港', 108.3],
            ['钦州', 108.6],
            ['贵港', 109.6],
            ['玉林', 110.2],
            ['百色', 106.6],
            ['贺州', 111.6],
            ['河池', 108.1],
            ['来宾', 109.2],
            ['崇左', 107.4]
        ]
    ],
    [
        '海南',
        [
            ['海口', 110.3],
            ['三亚', 109.5],
            ['三沙', 112.3],
            ['儋州', 109.6],
            ['五指山', 109.5],
            ['文昌', 110.8],
            ['琼海', 110.5],
            ['万宁', 110.4],
            ['东方', 108.6]
        ]
    ],
    [
        '四川',
        [
            ['成都', 104.1],
            ['自贡', 104.8],
            ['攀枝花', 101.7],
            ['泸州', 105.4],
            ['德阳', 104.4],
            ['绵阳', 104.7],
            ['广元', 105.8],
            ['遂宁', 105.6],
            ['内江', 105.1],
            ['乐山', 103.8],
            ['南充', 106.1],
            ['眉山', 103.8],
            ['宜宾', 104.6],
            ['广安', 106.6],
            ['达州', 107.5],
            ['雅安', 103.0],
            ['巴中', 106.7],
            ['资阳', 104.6],
            ['阿坝', 102.2],
            ['甘孜', 101.9],
            ['凉山', 102.3]
        ]
    ],
    [
        '贵州',
        [
            ['贵阳', 106.7],
            ['六盘水', 104.8],
            ['遵义', 106.9],
            ['安顺', 105.9],
            ['毕节', 105.3],
            ['铜仁', 109.2],
            ['黔西南', 104.9],
            ['黔东南', 107.9],
            ['黔南', 107.5]
        ]
    ],
    [
        '云南',
        [
            ['昆明', 102.7],
            ['曲靖', 103.8],
            ['玉溪', 102.5],
            ['保山', 99.2],
            ['昭通', 103.7],
            ['丽江', 100.2],
            ['普洱', 101.0],
            ['临沧', 100.1],
            ['楚雄', 101.5],
            ['红河', 103.4],
            ['文山', 104.2],
            ['西双版纳', 100.8],
            ['大理', 100.2],
            ['德宏', 98.6],
            ['怒江', 98.8],
            ['迪庆', 99.7]
        ]
    ],
    [
        '西藏',
        [
            ['拉萨', 91.1],
            ['日喀则', 88.9],
            ['昌都', 97.2],
            ['林芝', 94.4],
            ['山南', 91.8],
            ['那曲', 92.1],
            ['阿里', 80.1]
        ]
    ],
    [
        '陕西',
        [
            ['西安', 108.9],
            ['铜川', 108.9],
            ['宝鸡', 107.1],
            ['咸阳', 108.7],
            ['渭南', 109.5],
            ['延安', 109.5],
            ['汉中', 107.0],
            ['榆林', 109.7],
            ['安康', 109.0],
            ['商洛', 109.9]
        ]
    ],
    [
        '甘肃',
        [
            ['兰州', 103.8],
            ['嘉峪关', 98.3],
            ['金昌', 102.2],
            ['白银', 104.1],
            ['天水', 105.7],
            ['武威', 102.6],
            ['张掖', 100.5],
            ['平凉', 106.7],
            ['酒泉', 98.5],
            ['庆阳', 107.6],
            ['定西', 104.6],
            ['陇南', 104.9],
            ['临夏', 103.2],
            ['甘南', 103.0]
        ]
    ],
    [
        '青海',
        [
            ['西宁', 101.8],
            ['海东', 102.1],
            ['海北', 100.9],
            ['黄南', 102.0],
            ['海南', 100.6],
            ['果洛', 100.2],
            ['玉树', 97.0],
            ['海西', 97.4]
        ]
    ],
    [
        '宁夏',
        [
            ['银川', 106.3],
            ['石嘴山', 106.4],
            ['吴忠', 106.2],
            ['固原', 106.2],
            ['中卫', 105.2]
        ]
    ],
    [
        '新疆',
        [
            ['乌鲁木齐', 87.6],
            ['克拉玛依', 84.9],
            ['吐鲁番', 89.2],
            ['哈密', 93.5],
            ['昌吉', 87.3],
            ['博尔塔拉', 82.1],
            ['巴音郭楞', 86.1],
            ['阿克苏', 80.3],
            ['克孜勒苏', 76.2],
            ['喀什', 76.0],
            ['和田', 79.9],
            ['伊犁', 81.3],
            ['塔城', 82.9],
            ['阿勒泰', 88.1]
        ]
    ],
    ['香港', [['香港', 114.2]]],
    ['澳门', [['澳门', 113.5]]],
    [
        '台湾',
        [
            ['台北', 121.5],
            ['高雄', 120.3],
            ['台中', 120.7],
            ['台南', 120.2],
            ['基隆', 121.7],
            ['新竹', 121.0],
            ['嘉义', 120.4],
            ['花莲', 121.6],
            ['台东', 121.1]
        ]
    ]
];

/* ══════ Types ══════ */
export interface Pillar {
    stem: string;
    branch: string;
    sEl: string;
    bEl: string;
    hidden: {stem: string; el: string; w: number}[];
}
export interface FourPillars {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
}
export interface DayMaster {
    el: string;
    stem: string;
    st: boolean;
    fav: string;
    bad: string;
    favs: string[];
    bads: string[];
}
export interface DaYunPillar {
    stem: string;
    branch: string;
    sEl: string;
    bEl: string;
    startAge: number;
    endAge: number;
}
export interface DaYun {
    direction: string;
    startAge: number;
    pillars: DaYunPillar[];
}
export interface ElSum {
    dom: string;
    weak: string;
    bal: number;
}
export interface LinePt {
    age: number;
    year: number;
    score: number;
}
export interface KlinePt extends LinePt {
    open: number;
    close: number;
    high: number;
    low: number;
}
export interface MonthPt {
    month: number;
    score: number;
}
export interface DimScores {
    total: number;
    career: number;
    wealth: number;
    love: number;
    health: number;
}
export interface TLAnalysis {
    pk: LinePt;
    vl: LinePt;
    b5s: number;
    b5e: number;
    b5a: number;
    td: string;
}
export interface RadarItem {
    label: string;
    value: number;
}
export interface TSTInfo {
    origH: number;
    origMin: number;
    corrH: number;
    corrMin: number;
    correction: number;
    city: string;
}
export interface ReadingData {
    meta: {gt: string; curY: number; curA: number; score: number; dom: string; weak: string; bal: number};
    pillars: FourPillars;
    profile: Record<string, number>;
    dm: DayMaster;
    charts: {line: LinePt[]; kline: KlinePt[]};
    daYun: DaYun;
    es: ElSum;
    tl: TLAnalysis | null;
    narr: {p: string; c: string; l: string; w: string};
    name: string;
    gt: string;
    radarData: RadarItem[];
    yearBriefs: {age: number; year: number; text: string}[];
    tst: TSTInfo | null;
}

/* ══════ Helper functions ══════ */
export function clamp(v: number): number {
    return Math.max(60, Math.min(98, Math.round(v)));
}
export function sd(s: number, o: number): number {
    const r = Math.sin(s * 12.9898 + o * 78.233) * 43758.5453;
    return r - Math.floor(r);
}

export function getBaziYear(Y: number, M: number, D: number) {
    return M < 2 || (M === 2 && D < 4) ? Y - 1 : Y;
}
function getBaziMonthBranch(M: number, D: number) {
    let bi = 0;
    for (let i = 0; i < 12; i++) {
        const [jm, jd] = JIE_TABLE[i];
        if (M > jm || (M === jm && D >= jd)) {
            bi = JIE_BRANCH[i];
        } else {
            break;
        }
    }
    return bi;
}
export function getMonthStem(yearStemIdx: number, monthBranchIdx: number) {
    const base = MONTH_STEM_BASE[yearStemIdx % 5];
    const offset = (((monthBranchIdx - 2) % 12) + 12) % 12;
    return (base + offset) % 10;
}
function gzIndex(si: number, bi: number) {
    return (((si * 6 - bi * 5) % 60) + 60) % 60;
}

function getStartAge(Y: number, M: number, D: number, forward: boolean) {
    const dates: Date[] = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let i = 0; i < 12; i++) {
            const [jm, jd] = JIE_TABLE[i];
            dates.push(new Date(Y + dy, jm - 1, jd));
        }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
    const birth = new Date(Y, M - 1, D);
    if (forward) {
        for (const d of dates) {
            if (d > birth) {
                return Math.max(1, Math.round((d.getTime() - birth.getTime()) / 86400000 / 3));
            }
        }
        return 1;
    } else {
        for (let i = dates.length - 1; i >= 0; i--) {
            if (dates[i] <= birth) {
                return Math.max(1, Math.round((birth.getTime() - dates[i].getTime()) / 86400000 / 3));
            }
        }
        return 1;
    }
}

export function getTrueSolarTime(Y: number, M: number, D: number, H: number, min: number, lng: number) {
    const dt = new Date(Y, M - 1, D);
    const doy = Math.floor((dt.getTime() - new Date(Y, 0, 1).getTime()) / 864e5) + 1;
    const B = (2 * Math.PI * (doy - 81)) / 365;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const correction = Math.round((lng - 120) * 4 + eot);
    const cd = new Date(Y, M - 1, D, H, min + correction);
    return {
        Y: cd.getFullYear(),
        M: cd.getMonth() + 1,
        D: cd.getDate(),
        H: cd.getHours(),
        min: cd.getMinutes(),
        correction
    };
}

/* ══════ Pillar calculations ══════ */
export function getPillars(Y: number, M: number, D: number, H: number): FourPillars {
    const bY = getBaziYear(Y, M, D);
    const yi = (((bY - 4) % 10) + 10) % 10,
        yb = (((bY - 4) % 12) + 12) % 12;
    const mb = getBaziMonthBranch(M, D);
    const mi = getMonthStem(yi, mb);
    let jy = Y,
        jm = M;
    if (jm <= 2) {
        jy--;
        jm += 12;
    }
    const A = Math.floor(jy / 100),
        B2 = 2 - A + Math.floor(A / 4);
    const JDN = Math.floor(365.25 * (jy + 4716)) + Math.floor(30.6001 * (jm + 1)) + D + B2 - 1524;
    const dayIdx = (((JDN + 49) % 60) + 60) % 60,
        di = dayIdx % 10,
        db = dayIdx % 12;
    const hb = Math.floor((H + 1) / 2) % 12,
        hi = (HOUR_STEM_BASE[di % 5] + hb) % 10;
    const mk = (si: number, bi: number): Pillar => {
        const br = BRANCHES[bi],
            hs = HIDDEN_STEMS[br] || [];
        const hidden = hs.map(([hsi, w]) => ({stem: STEMS[hsi], el: S_EL[hsi], w}));
        return {stem: STEMS[si], branch: br, sEl: S_EL[si], bEl: B_EL[bi], hidden};
    };
    return {year: mk(yi, yb), month: mk(mi, mb), day: mk(di, db), hour: mk(hi, hb)};
}

export function getProfile(pil: FourPillars): Record<string, number> {
    const p: Record<string, number> = {'木': 0, '火': 0, '土': 0, '金': 0, '水': 0};
    p[pil.year.sEl] += 1.4;
    p[pil.month.sEl] += 1.3;
    p[pil.day.sEl] += 1.6;
    p[pil.hour.sEl] += 0.8;
    const bw = [1.1, 1.2, 1.0, 0.9];
    [pil.year, pil.month, pil.day, pil.hour].forEach((pl, i) => {
        const hs = HIDDEN_STEMS[pl.branch];
        if (hs) {
            hs.forEach(([si, r]) => {
                p[S_EL[si]] += bw[i] * r;
            });
        }
    });
    return p;
}

export function getElSum(p: Record<string, number>): ElSum {
    const e = EL.map(k => ({k, v: p[k]}));
    const dom = [...e].sort((a, b) => b.v - a.v)[0];
    const weak = [...e].sort((a, b) => a.v - b.v)[0];
    const avg = e.reduce((s, x) => s + x.v, 0) / 5;
    const spread = e.reduce((s, x) => s + Math.abs(x.v - avg), 0);
    return {dom: dom.k, weak: weak.k, bal: clamp(92 - spread * 4)};
}

export function getDM(pil: FourPillars, prof: Record<string, number>): DayMaster {
    const el = pil.day.sEl,
        stem = pil.day.stem;
    const sup: Record<string, string[]> = {
        '木': ['水', '木'],
        '火': ['木', '火'],
        '土': ['火', '土'],
        '金': ['土', '金'],
        '水': ['金', '水']
    };
    const sv = sup[el].reduce((s, e) => s + prof[e], 0),
        tot = Object.values(prof).reduce((s, v) => s + v, 0);
    const st = sv / tot > 0.42;
    const favMap: Record<string, string> = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'};
    const badMap: Record<string, string> = {'木': '水', '火': '木', '土': '火', '金': '土', '水': '金'};
    const fav = st ? favMap[el] : badMap[el];
    const bad = st ? badMap[el] : favMap[el];
    const genMe: Record<string, string> = {'木': '水', '火': '木', '土': '火', '金': '土', '水': '金'};
    const iGen = GEN_MAP[el],
        iCtrl = CTRL_MAP[el];
    const ctrlMeEl: Record<string, string> = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'};
    let favs: string[], bads: string[];
    if (st) {
        favs = [ctrlMeEl[el], iGen, iCtrl];
        bads = [genMe[el], el];
    } else {
        favs = [genMe[el], el];
        bads = [ctrlMeEl[el], iGen, iCtrl];
    }
    return {el, stem, st, fav, bad, favs, bads};
}

export function getDaYun(pil: FourPillars, gender: string, Y: number, M: number, D: number): DaYun {
    const ysi = STEMS.indexOf(pil.year.stem);
    const isYang = ysi % 2 === 0,
        isMale = gender === 'male';
    const forward = (isMale && isYang) || (!isMale && !isYang);
    const msi = STEMS.indexOf(pil.month.stem),
        mbi = BRANCHES.indexOf(pil.month.branch);
    const mGZ = gzIndex(msi, mbi);
    const sa = getStartAge(Y, M, D, forward);
    const pillars: DaYunPillar[] = [];
    for (let i = 1; i <= 9; i++) {
        const idx = (((mGZ + (forward ? i : -i)) % 60) + 60) % 60;
        const si = idx % 10,
            bi = idx % 12;
        pillars.push({
            stem: STEMS[si],
            branch: BRANCHES[bi],
            sEl: S_EL[si],
            bEl: B_EL[bi],
            startAge: sa + (i - 1) * 10,
            endAge: sa + i * 10 - 1
        });
    }
    return {direction: forward ? 'forward' : 'backward', startAge: sa, pillars};
}

export function getNarr(el: string) {
    const map: Record<string, {p: string; c: string; l: string; w: string}> = {
        '木': {
            p: '生发之气充沛，做事有推进力，遇到机会时习惯主动出击',
            c: '适合增长型、开拓型、内容型及需要带项目起盘的职业路径',
            l: '重共同成长与及时回应，关系中需要对方能跟上你的节奏',
            w: '适合靠能力扩张、副线延伸和资源嫁接逐步累积'
        },
        '火': {
            p: '外放热烈，表现力强，容易把能量传导给周围的人',
            c: '适合表达型、品牌型、运营型及需要制造曝光和带节奏的工作',
            l: '情绪表达直接，希望关系有温度和明确回应',
            w: '财运与曝光度、机会窗口、项目爆发力绑定更紧'
        },
        '土': {
            p: '稳重务实，耐压性强，做事讲究节奏和长期主义',
            c: '适合管理型、咨询型、统筹型及需要长线经营的岗位',
            l: '慢热但投入后极为稳定，重承诺和可持续的陪伴',
            w: '适合稳健储蓄、长期配置和资产沉淀型理财'
        },
        '金': {
            p: '边界感清晰，判断力强，做决定果断利落',
            c: '适合策略型、数据型、法务型及规则导向类岗位',
            l: '更看重尊重、边界和核心价值观的匹配度',
            w: '擅长风险控制和结构化管理，适合纪律性配置'
        },
        '水': {
            p: '直觉敏锐，感受力在线，适应变化和切换的能力突出',
            c: '适合研究型、策划型、创意型及连接沟通类角色',
            l: '需要情绪共鸣，容易被理解力和温柔度打动',
            w: '财富弹性偏大，适合信息差和资源整合型机会'
        }
    };
    return map[el] || map['木'];
}

function getAge(Y: number) {
    return Math.max(1, new Date().getFullYear() - Y);
}
function mxAge(c: number) {
    return Math.max(100, c);
}

/* ══════ Line/KLine builders ══════ */
export function buildLine(
    pil: FourPillars,
    prof: Record<string, number>,
    dm: DayMaster,
    daYun: DaYun,
    es: ElSum,
    birthYear: number,
    mx: number
): LinePt[] {
    const base = 74 + es.bal * 0.06;
    const s: LinePt[] = [];
    for (let a = 1; a <= mx; a++) {
        const y = birthYear + a;
        const lnSi = (((y - 4) % 10) + 10) % 10,
            lnBi = (((y - 4) % 12) + 12) % 12;
        const lnSE = S_EL[lnSi],
            lnBE = B_EL[lnBi];
        const dy = daYun.pillars.find(d => a >= d.startAge && a <= d.endAge) || {
            sEl: pil.month.sEl,
            bEl: pil.month.bEl
        };
        let elMod = 0;
        if (dy.sEl === dm.fav) {
            elMod += 6;
        }
        if (dy.bEl === dm.fav) {
            elMod += 4;
        }
        if (dy.sEl === dm.bad) {
            elMod -= 3;
        }
        if (dy.bEl === dm.bad) {
            elMod -= 2;
        }
        if (lnSE === dm.fav) {
            elMod += 4;
        }
        if (lnBE === dm.fav) {
            elMod += 3;
        }
        if (lnSE === dm.bad) {
            elMod -= 2;
        }
        if (lnBE === dm.bad) {
            elMod -= 1.5;
        }
        if (GEN_MAP[dy.sEl] === dm.el) {
            elMod += 2;
        }
        if (CTRL_MAP[dy.sEl] === dm.el) {
            elMod += dm.st ? 1 : -1;
        }
        if (GEN_MAP[lnSE] === dm.el) {
            elMod += 1.5;
        }
        if (CTRL_MAP[lnSE] === dm.el) {
            elMod += dm.st ? 0.5 : -0.5;
        }
        const stg = a <= 18 ? -1 : a <= 30 ? 2 : a <= 45 ? 4 : a <= 60 ? 2 : 0;
        const smooth = Math.sin(a * 0.7 + birthYear * 0.01) * 1.5 + Math.cos(a * 0.3 + birthYear * 0.03) * 1;
        s.push({age: a, year: y, score: clamp(base + elMod + stg + smooth)});
    }
    return s;
}

export function buildMainKline(line: LinePt[], seed: number): KlinePt[] {
    return line.map((pt, i) => {
        const c = pt.score,
            prev = i > 0 ? line[i - 1].score : c;
        const o = i === 0 ? c - 1 + (sd(seed, pt.age) - 0.5) * 2 : prev;
        const diff = Math.abs(c - o);
        const ext = Math.max(0.5, diff * 0.4 + sd(seed + 1, pt.age) * 1.5);
        const hi = Math.min(98, Math.max(c, o) + ext);
        const lo = Math.max(60, Math.min(c, o) - ext);
        return {
            age: pt.age,
            year: pt.year,
            open: Math.round(o * 10) / 10,
            close: c,
            high: Math.round(hi * 10) / 10,
            low: Math.round(lo * 10) / 10,
            score: c
        };
    });
}

export function analyzeTL(series: LinePt[], curA: number): TLAnalysis | null {
    const near = series.filter(p => p.age >= curA && p.age <= curA + 10);
    if (!near.length) {
        return null;
    }
    const pk = near.reduce((b, p) => (p.score > b.score ? p : b), near[0]);
    const vl = near.reduce((b, p) => (p.score < b.score ? p : b), near[0]);
    let b5s = 0,
        b5a = 0;
    for (let i = 0; i <= series.length - 5; i++) {
        const a = series.slice(i, i + 5).reduce((s, p) => s + p.score, 0) / 5;
        if (a > b5a) {
            b5a = a;
            b5s = series[i].age;
        }
    }
    const n3 = series.filter(p => p.age >= curA && p.age <= curA + 3);
    const td =
        n3.length >= 2
            ? n3[n3.length - 1].score - n3[0].score > 3
                ? '上升'
                : n3[n3.length - 1].score - n3[0].score < -3
                  ? '下行'
                  : '平稳'
            : '平稳';
    return {pk, vl, b5s, b5e: b5s + 4, b5a: Math.round(b5a), td};
}

/* ══════ Label helpers ══════ */
export function stgL(a: number) {
    return a <= 6
        ? '启蒙期'
        : a <= 12
          ? '成长期'
          : a <= 18
            ? '筑基期'
            : a <= 30
              ? '展开期'
              : a <= 45
                ? '发力期'
                : a <= 60
                  ? '沉淀期'
                  : '回收期';
}
export function stgT(a: number) {
    return a <= 6
        ? '重在探索和建立安全感'
        : a <= 12
          ? '重在培养习惯和兴趣'
          : a <= 18
            ? '先把基础和习惯立住'
            : a <= 30
              ? '适合试方向、定节奏'
              : a <= 45
                ? '适合拉开事业差距'
                : a <= 60
                  ? '重在稳住成果和结构'
                  : '更适合回收成果、调配重心';
}
export function bandL(s: number) {
    return s >= 93 ? '强势' : s >= 85 ? '偏强' : s >= 76 ? '平稳' : s >= 68 ? '回调' : '承压';
}
export function bandLA(s: number, a: number) {
    if (a <= 6) {
        return s >= 93 ? '元气满满' : s >= 85 ? '活力充沛' : s >= 76 ? '平稳成长' : s >= 68 ? '小有波动' : '需要呵护';
    }
    if (a <= 12) {
        return s >= 93 ? '状态拉满' : s >= 85 ? '势头不错' : s >= 76 ? '稳步前进' : s >= 68 ? '略有起伏' : '需要关注';
    }
    if (a <= 18) {
        return s >= 93 ? '全力冲刺' : s >= 85 ? '势头向好' : s >= 76 ? '平稳推进' : s >= 68 ? '压力渐显' : '需要调整';
    }
    return bandL(s);
}

/* ══════ Dim Scores ══════ */
export function buildDimScores(
    yearPt: LinePt,
    pil: FourPillars,
    prof: Record<string, number>,
    dm: DayMaster,
    daYun: DaYun,
    es: ElSum
): DimScores {
    const total = yearPt.score,
        yr = yearPt.year,
        age = yearPt.age;
    const lnSi = (((yr - 4) % 10) + 10) % 10,
        lnBi = (((yr - 4) % 12) + 12) % 12;
    const lnSE = S_EL[lnSi],
        lnBE = B_EL[lnBi];
    const dy = daYun.pillars.find(d => age >= d.startAge && age <= d.endAge) || {
        sEl: pil.month.sEl,
        bEl: pil.month.bEl
    };
    const officialEl: Record<string, string> = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'};
    const wealthEl = GEN_MAP[dm.el];
    const LH: Record<string, string> = {
        '子': '丑',
        '丑': '子',
        '寅': '亥',
        '卯': '戌',
        '辰': '酉',
        '巳': '申',
        '午': '未',
        '未': '午',
        '申': '巳',
        '酉': '辰',
        '戌': '卯',
        '亥': '寅'
    };
    const dayBr = pil.day.branch,
        lnBr = BRANCHES[lnBi];

    let car = total;
    if (pil.month.sEl === dm.fav) {
        car += 4;
    }
    if (pil.month.sEl === dm.bad) {
        car -= 3;
    }
    const offE = prof[officialEl[dm.el]] || 0;
    car += offE >= 2.5 ? 3 : offE >= 1 ? 1 : -2;
    if (dy.sEl === officialEl[dm.el]) {
        car += 2;
    }
    if (lnSE === officialEl[dm.el]) {
        car += 1.5;
    }
    car += dm.st ? 2 : -1;
    if (dy.sEl === dm.fav) {
        car += 1.5;
    }
    if (dy.sEl === dm.bad) {
        car -= 1;
    }
    car += Math.sin(yr * 0.3) * 1.5;

    let wea = total;
    const weE = prof[wealthEl] || 0;
    wea += weE >= 2.5 ? 4 : weE >= 1 ? 1 : -2;
    if (dy.sEl === wealthEl || dy.bEl === wealthEl) {
        wea += 3;
    }
    if (lnSE === wealthEl || lnBE === wealthEl) {
        wea += 2;
    }
    wea += dm.st ? 2 : -1;
    wea += Math.cos(yr * 0.4) * 1.5;

    let lov = total;
    const dayHidden = HIDDEN_STEMS[dayBr] || [];
    dayHidden.forEach(([si]) => {
        if (S_EL[si] === dm.fav) {
            lov += 3;
        }
        if (S_EL[si] === dm.bad) {
            lov -= 2;
        }
    });
    if (LH[dayBr] === lnBr) {
        lov += 3;
    }
    if (dy.sEl === dm.fav || dy.bEl === dm.fav) {
        lov += 2;
    }
    if (lnSE === dm.fav) {
        lov += 1;
    }
    if (lnSE === dm.bad) {
        lov -= 1;
    }
    lov += Math.sin(yr * 0.5 + age * 0.1) * 1.5;

    let hea = total - 2;
    hea += es.bal >= 85 ? 3 : es.bal >= 75 ? 1 : -2;
    if (dy.sEl === dm.bad || lnSE === dm.bad) {
        hea -= 2;
    }
    if (CTRL_MAP[lnSE] === dm.el) {
        hea -= dm.st ? 0 : 1.5;
    }
    hea += dm.st ? 2 : -1;
    if (age > 60) {
        hea -= 2;
    } else if (age > 45) {
        hea -= 1;
    }
    hea += Math.cos(yr * 0.6 + age * 0.2) * 1;

    return {total, career: clamp(car), wealth: clamp(wea), love: clamp(lov), health: clamp(hea)};
}

export function buildMonthWealth(
    yearPt: LinePt,
    pil: FourPillars,
    prof: Record<string, number>,
    dm: DayMaster,
    daYun: DaYun,
    es: ElSum
): MonthPt[] {
    const yr = yearPt.year,
        age = yearPt.age;
    const wealthEl = GEN_MAP[dm.el];
    const dy = daYun.pillars.find(d => age >= d.startAge && age <= d.endAge) || {
        sEl: pil.month.sEl,
        bEl: pil.month.bEl
    };
    const yearScores = buildDimScores(yearPt, pil, prof, dm, daYun, es);
    const base = yearScores.wealth;
    const months: MonthPt[] = [];
    for (let m = 1; m <= 12; m++) {
        const ySi = (((getBaziYear(yr, m, 15) - 4) % 10) + 10) % 10;
        const mBi = m % 12;
        const mSi = getMonthStem(ySi, mBi);
        const mSE = S_EL[mSi],
            mBE = B_EL[mBi];
        let mod = 0;
        if (mSE === wealthEl) {
            mod += 3;
        }
        if (mBE === wealthEl) {
            mod += 2;
        }
        if (mSE === dm.fav) {
            mod += 2;
        }
        if (mBE === dm.fav) {
            mod += 1.5;
        }
        if (mSE === dm.bad) {
            mod -= 2;
        }
        if (mBE === dm.bad) {
            mod -= 1.5;
        }
        const season = m <= 1 || m >= 11 ? '水' : m <= 4 ? '木' : m <= 7 ? '火' : '金';
        if (season === wealthEl) {
            mod += 1.5;
        }
        if (season === dm.bad) {
            mod -= 1;
        }
        if (dy.sEl === wealthEl) {
            mod += 1;
        }
        mod += Math.sin(m * 0.8 + yr * 0.05) * 1.2;
        months.push({month: m, score: clamp(base + mod)});
    }
    return months;
}

export function buildMonthLove(
    yearPt: LinePt,
    pil: FourPillars,
    prof: Record<string, number>,
    dm: DayMaster,
    daYun: DaYun,
    es: ElSum
): MonthPt[] {
    const yr = yearPt.year,
        age = yearPt.age;
    const dy = daYun.pillars.find(d => age >= d.startAge && age <= d.endAge) || {
        sEl: pil.month.sEl,
        bEl: pil.month.bEl
    };
    const yearScores = buildDimScores(yearPt, pil, prof, dm, daYun, es);
    const base = yearScores.love;
    const dayBr = BRANCHES.indexOf(pil.day.branch);
    const LH: Record<string, string> = {
        '子': '丑',
        '丑': '子',
        '寅': '亥',
        '卯': '戌',
        '辰': '酉',
        '巳': '申',
        '午': '未',
        '未': '午',
        '申': '巳',
        '酉': '辰',
        '戌': '卯',
        '亥': '寅'
    };
    const peach = [0, 3, 6, 9];
    const months: MonthPt[] = [];
    for (let m = 1; m <= 12; m++) {
        const ySi = (((getBaziYear(yr, m, 15) - 4) % 10) + 10) % 10;
        const mBi = m % 12;
        const mSi = getMonthStem(ySi, mBi);
        const mSE = S_EL[mSi],
            mBE = B_EL[mBi];
        let mod = 0;
        if (mSE === dm.fav) {
            mod += 2.5;
        }
        if (mBE === dm.fav) {
            mod += 2;
        }
        if (mSE === dm.bad) {
            mod -= 2;
        }
        if (mBE === dm.bad) {
            mod -= 1.5;
        }
        if (LH[BRANCHES[dayBr]] === BRANCHES[mBi]) {
            mod += 4;
        }
        if (peach.includes(mBi)) {
            mod += 2;
        }
        if (dy.sEl === dm.fav) {
            mod += 1;
        }
        if (dy.bEl === dm.fav) {
            mod += 0.5;
        }
        const season = m <= 1 || m >= 11 ? '水' : m <= 4 ? '木' : m <= 7 ? '火' : '金';
        if (season === '火' || season === '木') {
            mod += 1;
        }
        mod += Math.sin(m * 0.9 + yr * 0.07) * 1.3;
        months.push({month: m, score: clamp(base + mod)});
    }
    return months;
}

export function buildMonthCareer(
    yearPt: LinePt,
    pil: FourPillars,
    prof: Record<string, number>,
    dm: DayMaster,
    daYun: DaYun,
    es: ElSum
): MonthPt[] {
    const yr = yearPt.year,
        age = yearPt.age;
    const dy = daYun.pillars.find(d => age >= d.startAge && age <= d.endAge) || {
        sEl: pil.month.sEl,
        bEl: pil.month.bEl
    };
    const yearScores = buildDimScores(yearPt, pil, prof, dm, daYun, es);
    const base = yearScores.career;
    const officialEl: Record<string, string> = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'};
    const months: MonthPt[] = [];
    for (let m = 1; m <= 12; m++) {
        const ySi = (((getBaziYear(yr, m, 15) - 4) % 10) + 10) % 10;
        const mBi = m % 12;
        const mSi = getMonthStem(ySi, mBi);
        const mSE = S_EL[mSi],
            mBE = B_EL[mBi];
        let mod = 0;
        if (mSE === officialEl[dm.el]) {
            mod += 3;
        }
        if (mBE === officialEl[dm.el]) {
            mod += 2;
        }
        if (mSE === dm.fav) {
            mod += 2.5;
        }
        if (mBE === dm.fav) {
            mod += 1.5;
        }
        if (mSE === dm.bad) {
            mod -= 2;
        }
        if (mBE === dm.bad) {
            mod -= 1.5;
        }
        if (mSE === pil.month.sEl) {
            mod += 1.5;
        }
        if (dy.sEl === officialEl[dm.el]) {
            mod += 1;
        }
        if (dy.sEl === dm.fav) {
            mod += 0.5;
        }
        mod += dm.st ? 1 : -0.5;
        const season = m <= 1 || m >= 11 ? '水' : m <= 4 ? '木' : m <= 7 ? '火' : '金';
        if (season === dm.fav) {
            mod += 1.5;
        }
        if (season === dm.bad) {
            mod -= 1;
        }
        mod += Math.sin(m * 0.7 + yr * 0.04) * 1.2;
        months.push({month: m, score: clamp(base + mod)});
    }
    return months;
}

export function getRadarData(prof: Record<string, number>, dm: DayMaster, es: ElSum, pil: FourPillars): RadarItem[] {
    const tot = Object.values(prof).reduce((s, v) => s + v, 0) || 1;
    const r = (e: string) => (prof[e] || 0) / tot;
    const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const ctrlMe: Record<string, string> = {'木': '金', '火': '水', '土': '木', '金': '火', '水': '土'};
    const genMe: Record<string, string> = {'木': '水', '火': '木', '土': '火', '金': '土', '水': '金'};
    const sameR = r(dm.el),
        ctrlMeR = r(ctrlMe[dm.el]);
    const iGen = GEN_MAP[dm.el];
    const isYang = STEMS.indexOf(pil.day.stem) % 2 === 0;
    return [
        {
            label: '主导性',
            value: cl(Math.round((dm.st ? 62 : 34) + sameR * 70 + ctrlMeR * 35 + (es.bal > 82 ? 4 : -3)), 20, 98)
        },
        {label: '表达力', value: cl(Math.round(42 + r(iGen) * 110 + r('火') * 45 + (dm.st ? 5 : -4)), 20, 98)},
        {
            label: '行动力',
            value: cl(Math.round((dm.st ? 55 : 36) + r('木') * 55 + r('火') * 35 + (isYang ? 8 : 0)), 20, 98)
        },
        {label: '规则感', value: cl(Math.round(38 + ctrlMeR * 85 + r('金') * 55 + r('土') * 35), 20, 98)},
        {label: '变通度', value: cl(Math.round(40 + r('水') * 100 + r(iGen) * 50 + (100 - es.bal) * 0.3), 20, 98)},
        {
            label: '抗压性',
            value: cl(
                Math.round((dm.st ? 62 : 35) + r(genMe[dm.el]) * 80 + r('土') * 50 + (es.bal > 80 ? 8 : 0)),
                20,
                98
            )
        }
    ];
}

/* ══════ Generate full reading ══════ */
export interface FormInput {
    name: string;
    g: string;
    bd: string;
    bt: string;
    bp: string;
    bpName: string;
}

export function generate(form: FormInput): ReadingData {
    const [Y, M, D] = form.bd.split('-').map(Number);
    const [H, m] = form.bt.split(':').map(Number);
    const lng = form.bp ? parseFloat(form.bp) : 0;
    const tst = lng ? getTrueSolarTime(Y, M, D, H, m, lng) : {Y, M, D, H, min: m, correction: 0};
    const curA = getAge(Y),
        mx = mxAge(curA);
    const seed =
        Y * 100000 + M * 1700 + D * 43 + H * 17 + m * 3 + form.name.length * 29 + (form.g === 'female' ? 97 : 31);
    const pil = getPillars(tst.Y, tst.M, tst.D, tst.H);
    const prof = getProfile(pil),
        es = getElSum(prof),
        dm = getDM(pil, prof);
    const daYunResult = getDaYun(pil, form.g, tst.Y, tst.M, tst.D);
    const narr = getNarr(es.dom);
    const line = buildLine(pil, prof, dm, daYunResult, es, Y, mx);
    const kline = buildMainKline(line, seed);
    const cp = line.find(i => i.age === curA) || line[line.length - 1];
    const tl = analyzeTL(line, curA);
    const gt = form.g === 'female' ? '女' : '男';
    const radarData = getRadarData(prof, dm, es, pil);
    const curY = new Date().getFullYear();

    // yearBriefs — only explain factors already used by buildLine:
    // life stage, annual stem/branch elements, active Da Yun, and adjacent score changes.
    const yearBriefs = line.map((it, i, l) => {
        const prev = l[i - 1],
            next = l[i + 1];
        const s = it.score,
            a = it.age,
            y = it.year;
        const stemIndex = (((y - 4) % 10) + 10) % 10;
        const branchIndex = (((y - 4) % 12) + 12) % 12;
        const yearStem = STEMS[stemIndex];
        const yearBranch = BRANCHES[branchIndex];
        const yearStemEl = S_EL[stemIndex];
        const yearBranchEl = B_EL[branchIndex];
        const activeDy = daYunResult.pillars.find(d => a >= d.startAge && a <= d.endAge);
        const deltaPrev = prev ? Math.round((s - prev.score) * 10) / 10 : 0;
        const deltaNext = next ? Math.round((next.score - s) * 10) / 10 : 0;
        const peaking = Boolean(prev && next && deltaPrev >= 2 && deltaNext <= -2);
        const bottoming = Boolean(prev && next && deltaPrev <= -2 && deltaNext >= 2);

        const annualFav = [yearStemEl, yearBranchEl].filter(el => el === dm.fav).length;
        const annualBad = [yearStemEl, yearBranchEl].filter(el => el === dm.bad).length;
        const dyFav = activeDy ? [activeDy.sEl, activeDy.bEl].filter(el => el === dm.fav).length : 0;
        const dyBad = activeDy ? [activeDy.sEl, activeDy.bEl].filter(el => el === dm.bad).length : 0;

        let trendText: string;
        if (!prev) {
            trendText = '这是图谱的第一个年份，先看这一年的状态即可';
        } else if (peaking) {
            trendText = `比上一年高${Math.abs(deltaPrev)}分，也是前后几年里的高点`;
        } else if (bottoming) {
            trendText = `比上一年低${Math.abs(deltaPrev)}分，不过下一年会开始回升`;
        } else if (deltaPrev >= 2) {
            trendText = `比上一年高${deltaPrev}分，状态正在往上走`;
        } else if (deltaPrev <= -2) {
            trendText = `比上一年低${Math.abs(deltaPrev)}分，需要稍微放慢一点`;
        } else {
            trendText = `和上一年差不多，没有明显起伏`;
        }

        const supportCount = annualFav + dyFav;
        const restraintCount = annualBad + dyBad;
        let factorText: string;
        if (supportCount > restraintCount) {
            factorText = '这一年顺势感比较明显，做事更容易进入状态';
        } else if (restraintCount > supportCount) {
            factorText = '这一年阻力感会更强，稳住节奏比硬冲更重要';
        } else if (supportCount > 0) {
            factorText = '这一年有顺有阻，整体仍能保持平衡';
        } else {
            factorText = '这一年整体节奏平稳，没有明显的外部推力或阻力';
        }

        let stageAdvice: string;
        if (a <= 6) {
            stageAdvice = s >= 78
                ? '吃好、睡好、多探索，就是这一阶段最重要的事'
                : '先把作息和安全感稳住，不用急着追进度';
        } else if (a <= 12) {
            stageAdvice = s >= 78
                ? '可以多试几种兴趣，找到愿意长期坚持的事'
                : '先守住学习和生活规律，不必频繁换方向';
        } else if (a <= 18) {
            stageAdvice = s >= 78
                ? '目标可以定高一点，但别把休息排除在计划之外'
                : '先把大目标拆小，稳稳完成比临时冲刺更有效';
        } else if (a <= 30) {
            stageAdvice = s >= 82
                ? '适合主动尝试，在行动里确认长期方向'
                : s >= 72
                  ? '这一阶段重在积累和试错，不必急着给自己定型'
                  : '先稳住基本盘，把精力留给最重要的事';
        } else if (a <= 45) {
            stageAdvice = s >= 82
                ? '把资源集中到成熟方向，少做无效分散'
                : s >= 72
                  ? '按计划稳步推进，长期积累比短期冒进更可靠'
                  : '适当做减法，先解决最关键的问题';
        } else if (a <= 60) {
            stageAdvice = s >= 80
                ? '经验就是优势，优化现有结构比盲目扩张更合适'
                : '把节奏放稳，精力和健康要一起算进计划里';
        } else {
            stageAdvice = s >= 78
                ? '把时间留给喜欢的人和事，日子会更有滋味'
                : '别被短期高低牵着走，身体和心情更重要';
        }

        const currentNote = a === curA ? '这是你现在所处的阶段。' : '';
        const text = `${a}岁 · ${stgL(a)}。${currentNote}${factorText}。${trendText}。${stageAdvice}。`;
        return {age: it.age, year: it.year, text};
    });

    return {
        meta: {gt, curY, curA, score: cp.score, dom: es.dom, weak: es.weak, bal: es.bal},
        pillars: pil,
        profile: prof,
        dm,
        charts: {line, kline},
        daYun: daYunResult,
        es,
        tl,
        narr,
        name: form.name,
        gt,
        radarData,
        yearBriefs,
        tst: lng
            ? {origH: H, origMin: m, corrH: tst.H, corrMin: tst.min, correction: tst.correction, city: form.bpName}
            : null
    };
}

/* ══════ scoreGrade ══════ */
export function scoreGrade(s: number): string {
    if (s >= 92) {
        return '天命之年';
    }
    if (s >= 85) {
        return '顺势而为';
    }
    if (s >= 78) {
        return '稳中有进';
    }
    if (s >= 70) {
        return '平淡积累';
    }
    return '蓄势待发';
}

/* ══════ Career Phases ══════ */
export interface CareerPhaseSegment {
    phase: 'peak' | 'push' | 'steady' | 'gather' | 'wrap';
    start: number;
    end: number;
}

export interface CareerPhaseResult {
    phases: string[];
    segments: CareerPhaseSegment[];
    peakMonth: number;
    startMonth: number;
    adjustMonth: number;
    pushMonths: string[];
    gatherMonths: string[];
}

export function buildCareerPhases(monthScores: MonthPt[]): CareerPhaseResult {
    const scores = monthScores.map(d => d.score);
    const avg = scores.reduce((a, b) => a + b, 0) / 12;
    const mx = Math.max(...scores),
        mn = Math.min(...scores);
    const hi = avg + (mx - avg) * 0.45,
        lo = avg - (avg - mn) * 0.45;
    const phaseOf = (v: number) =>
        v >= hi + 3 ? 'peak' : v >= hi ? 'push' : v <= lo ? 'gather' : v <= lo + 3 ? 'wrap' : 'steady';
    const phases = scores.map(phaseOf) as CareerPhaseResult['phases'];

    const segments: CareerPhaseSegment[] = [];
    let cur: CareerPhaseSegment = {phase: phases[0] as CareerPhaseSegment['phase'], start: 0, end: 0};
    for (let i = 1; i < 12; i++) {
        if (phases[i] === cur.phase) {
            cur.end = i;
        } else {
            segments.push(cur);
            cur = {phase: phases[i] as CareerPhaseSegment['phase'], start: i, end: i};
        }
    }
    segments.push(cur);

    const peakIdx = scores.indexOf(mx);
    let startMonth = 0;
    for (let i = 0; i < 12; i++) {
        if (phases[i] === 'push' || phases[i] === 'peak') {
            startMonth = i + 1;
            break;
        }
    }
    let adjustMonth = 0;
    for (let i = peakIdx + 1; i < 12; i++) {
        if (phases[i] === 'steady' || phases[i] === 'gather' || phases[i] === 'wrap') {
            adjustMonth = i + 1;
            break;
        }
    }
    const pushMonths = monthScores
        .filter(d => {
            const p = phaseOf(d.score);
            return p === 'peak' || p === 'push';
        })
        .map(d => d.month + '月');
    const gatherMonths = monthScores
        .filter(d => {
            const p = phaseOf(d.score);
            return p === 'gather' || p === 'wrap';
        })
        .map(d => d.month + '月');

    return {phases, segments, peakMonth: peakIdx + 1, startMonth, adjustMonth, pushMonths, gatherMonths};
}

/* ══════ Year Insight ══════ */
export function buildYearInsight(yearPt: LinePt, dm: DayMaster, scores: DimScores, st: Record<string, string>): string {
    const DIMS_INFO = [
        {key: 'career', label: '事业'},
        {key: 'wealth', label: '财富'},
        {key: 'love', label: '感情'},
        {key: 'health', label: '健康'}
    ];
    const s = yearPt.score,
        a = yearPt.age,
        yr = yearPt.year;
    const sc = scores as unknown as Record<string, number>;
    const hi = DIMS_INFO.reduce((best, d) => (sc[d.key] >= sc[best.key] ? d : best), DIMS_INFO[0]);
    const lo = DIMS_INFO.reduce((best, d) => (sc[d.key] <= sc[best.key] ? d : best), DIMS_INFO[0]);
    let vibe = '',
        advice = '';

    if (a <= 3) {
        if (s >= 85) {
            vibe = `${yr}年，${a}岁的小朋友运势在线，天生自带buff，吃好睡好就是最大的修行。`;
            advice = `<b>核心任务：健康成长。</b>这个年纪最重要的事业就是长身体，最大的财富就是全家人的爱。${hi.label}维度最亮（${sc[hi.key]}分），说明命格底子不错，慢慢来不着急。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势平稳，小宝贝正在认识这个世界，每一天都是新副本。`;
            advice = `<b>核心任务：探索世界。</b>吃饭、睡觉、玩耍就是全部日程。${lo.label}稍弱（${sc[lo.key]}分），但在这个年纪完全不用操心，长大自然就好了。`;
        } else {
            vibe = `${yr}年运势偏低调，不过别担心——人家才${a}岁，人生还没正式开始呢。`;
            advice = `<b>核心任务：平安快乐。</b>这个阶段规律饮食、稳定作息和安全感最重要。${dm.fav}属性的环境与你更合拍，比如${dm.fav === '水' ? '听音乐、亲近水' : dm.fav === '木' ? '接触自然和绿植' : dm.fav === '火' ? '多晒太阳、接触暖色' : dm.fav === '金' ? '保持环境整洁有序' : '饮食均衡、多接触自然'}。`;
        }
    } else if (a <= 12) {
        if (s >= 85) {
            vibe = `${yr}年，${a}岁的少年运势高开，学什么都快，属于"别人家的孩子"体质。`;
            advice = `<b>核心策略：兴趣驱动。</b>这是打基础的黄金期，不用卷成绩但值得多尝试。${hi.label}维度突出（${sc[hi.key]}分），顺着天赋走不费劲。适当培养${dm.fav}属性相关的兴趣爱好，事半功倍。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势稳当，${a}岁的小朋友按部就班成长中，没毛病。`;
            advice = `<b>核心策略：快乐学习。</b>成绩重要但不是全部，身心状态更值得关注。${lo.label}偏弱（${sc[lo.key]}分），${lo.key === 'health' ? '注意用眼和运动' : lo.key === 'love' ? '可以多参加集体活动，练习表达和相处' : '不必着急，按节奏积累'}。`;
        } else {
            vibe = `${yr}年运势偏弱，但${a}岁的孩子运势波动很正常，不必焦虑。`;
            advice = `<b>核心策略：陪伴和鼓励。</b>低谷期更需要家庭的温暖。${hi.label}还不错（${sc[hi.key]}分），多在这方面给孩子正反馈。少报补习班，多去公园跑跑。`;
        }
    } else if (a <= 18) {
        if (s >= 85) {
            vibe = `${yr}年，${a}岁的运势直接起飞，考试运、人缘运都在线，是全力冲刺的好年份。`;
            advice = `<b>核心策略：集中火力。</b>${hi.label}维度拉满（${sc[hi.key]}分），是你的王牌。学业上适合冲击目标院校，但也别忽略身体——熬夜有上限。${dm.fav}属性的月份安排重要考试和决定，赢面更大。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势中规中矩，${a}岁正是打地基的年纪，稳扎稳打就好。`;
            advice = `<b>核心策略：补短板。</b>${lo.label}偏弱（${sc[lo.key]}分），${lo.key === 'career' ? '偏科的话趁早补，高考不等人' : lo.key === 'health' ? '别拿身体换成绩，注意颈椎和眼睛' : lo.key === 'love' ? '青春期社交困惑很正常，过来人都懂' : '合理规划零花钱也是一种能力'}。`;
        } else {
            vibe = `${yr}年运势承压，但${a}岁遇到低谷不是坏事——早经历早成长。`;
            advice = `<b>核心策略：心态第一。</b>成绩有波动很正常，别因一次考砸就否定自己。${hi.label}还有${sc[hi.key]}分的底气，守住优势科目。学会跟压力相处，这个本事比任何知识点都值钱。`;
        }
    } else if (a <= 30) {
        if (s >= 90) {
            vibe = `${yr}年运势直接拉满，${a}岁正是冲劲最足的年纪，老天还给你开了加速器。`;
            advice = `<b>核心策略：大胆出击。</b>事业上争曝光、争资源，该主动的别矜持。感情上适合推进关键节点。${hi.label}是最强维度（${sc[hi.key]}分），重点押注不亏。年轻就是资本，试错成本最低的时候，别怂。`;
        } else if (s >= 80) {
            vibe = `${yr}年运势中上，${a}岁节奏稳健。不算躺赢但明显有牌可打，关键是别浪。`;
            advice = `<b>核心策略：稳中求进。</b>${hi.label}最亮眼（${sc[hi.key]}分），是发力点；${lo.label}偏弱（${sc[lo.key]}分），别在这个方向赌太大。${dm.st ? '身强之人控制住冲劲，把力气花在刀刃上' : '身弱之人多借团队和平台的力，别硬扛'}。`;
        } else if (s >= 70) {
            vibe = `${yr}年属于蓄力期，${a}岁看起来平淡，但今年种的因决定后面好几年的果。`;
            advice = `<b>核心策略：深耕内功。</b>适合学新技能、攒人脉、修复关系。${hi.label}相对能打（${sc[hi.key]}分），维持住就好。${dm.fav}属性的月份多安排重要事项，${dm.bad}属性的月份低调为主。`;
        } else {
            vibe = `${yr}年运势偏低，但${a}岁的低谷只是蹲下来跳得更高。`;
            advice = `<b>核心策略：守住基本盘。</b>别冲动裸辞、冲动分手、冲动投资——三不原则。${hi.label}还有${sc[hi.key]}分，是为数不多的支撑点。${dm.st ? '收着点锋芒，韧性比冲劲更值钱' : '主动寻求贵人支持，开口求助不丢人'}。`;
        }
    } else if (a <= 45) {
        if (s >= 90) {
            vibe = `${yr}年运势大吉，${a}岁经验和运气双重加持，属于老天爷追着喂饭。`;
            advice = `<b>核心策略：乘势扩张。</b>事业上可以争取更大的盘子，财务上适当扩大投资半径。${hi.label}拉满（${sc[hi.key]}分），是绝对的发力方向。这个年纪的高光期含金量极高，别浪费。`;
        } else if (s >= 80) {
            vibe = `${yr}年运势稳健，${a}岁正是黄金发力期，有实力有机会。`;
            advice = `<b>核心策略：效率优先。</b>时间是最贵的资源，少做无效社交。${hi.label}（${sc[hi.key]}分）值得加码；${lo.label}（${sc[lo.key]}分）做好风控就行。${dm.st ? '中年身强，小心刚过易折' : '中年身弱，学会借力打力'}。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势平稳，${a}岁的平稳不是无聊，是在为下一次爆发攒弹药。`;
            advice = `<b>核心策略：守正出奇。</b>基本盘不动，小范围试新方向。${lo.label}是短板（${sc[lo.key]}分），${lo.key === 'health' ? '健康投资回报率最高，别省' : '做好防守别踩坑就行'}。中年人最怕的不是没机会，是选错赛道。`;
        } else {
            vibe = `${yr}年运势承压，${a}岁的低谷期确实不太舒服，但你比年轻时有更多底牌。`;
            advice = `<b>核心策略：战略收缩。</b>砍掉不赚钱的投入，守住核心资产。${hi.label}还有${sc[hi.key]}分的空间，是穿越周期的锚。家庭是最稳的后盾，别忽视。`;
        }
    } else if (a <= 60) {
        if (s >= 90) {
            vibe = `${yr}年运势大旺，${a}岁依然能打，多年积累在这一年集中兑现。`;
            advice = `<b>核心策略：收获季。</b>之前种下的因，现在结果了。${hi.label}（${sc[hi.key]}分）是主收益方向。适合做长线决策、传承规划。身体是一切的本钱，高光期也别忘记体检。`;
        } else if (s >= 80) {
            vibe = `${yr}年运势不错，${a}岁经验丰富，知道什么该做什么该放下。`;
            advice = `<b>核心策略：从容布局。</b>不用再证明什么，做自己擅长的就好。${lo.label}偏弱（${sc[lo.key]}分），${lo.key === 'health' ? '健康是头等大事，定期复查' : '接受它，把精力给高回报的事'}。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势平和，${a}岁的平稳是一种福气，安安稳稳就很好。`;
            advice = `<b>核心策略：知足常乐。</b>别跟年轻人比冲劲，你有他们没有的阅历和定力。${hi.label}（${sc[hi.key]}分）是你的压舱石。适合整理人际关系，留下真正重要的人。`;
        } else {
            vibe = `${yr}年运势偏低，${a}岁的身体和心态比运势数字重要得多。`;
            advice = `<b>核心策略：减法生活。</b>减少不必要的操心和消耗，把能量留给自己。${hi.label}（${sc[hi.key]}分）守住就好。多出门走走、晒晒太阳，好心情比好运势管用。`;
        }
    } else {
        if (s >= 85) {
            vibe = `${yr}年，${a}岁运势依然红火，退休生活过得比上班还精彩，令人羡慕。`;
            advice = `<b>核心关注：享受生活。</b>${hi.label}维度亮眼（${sc[hi.key]}分），${hi.key === 'career' ? '发挥余热，当顾问或带徒弟都很合适' : hi.key === 'wealth' ? '财务无忧是最大的底气' : hi.key === 'love' ? '有人陪伴是最大的幸福' : '身体硬朗就是最大的资本'}。适合旅行、学新东西、培养爱好，人生下半场同样精彩。`;
        } else if (s >= 70) {
            vibe = `${yr}年运势平和，${a}岁不求大富大贵，身边有人、心里有光就够了。`;
            advice = `<b>核心关注：身心平衡。</b>保持规律作息和适度运动。${lo.label}稍弱（${sc[lo.key]}分），${lo.key === 'health' ? '这个年纪健康是第一优先级，一定要重视体检和复查' : '不必在意，把精力给让你开心的事'}。生活节奏慢下来，反而能看见更多风景。`;
        } else {
            vibe = `${yr}年运势偏低调，${a}岁最重要的不是运势高低，是每一天都舒心。`;
            advice = `<b>核心关注：顺其自然。</b>不和自己较劲，不和身体较劲。${hi.label}（${sc[hi.key]}分）说明生活中还是有亮点的。子女的关心、老友的陪伴、清晨的阳光——这些不在评分里，但比什么都值钱。`;
        }
    }

    return `<div class="${st.yearInsightTitle || ''}">✦ ${yr}年度洞察</div><p>${vibe}</p><p>${advice}</p>`;
}

/* ══════ Career Bar HTML ══════ */
export function buildCareerBarHtml(monthScores: MonthPt[], st: Record<string, string>): string {
    const cp = buildCareerPhases(monthScores);
    const cfg: Record<string, {label: string; bg: string; fg: string}> = {
        peak: {label: '🔥 发力窗口', bg: 'linear-gradient(135deg,#4f46e5,#6366f1)', fg: '#fff'},
        push: {label: '推进期', bg: 'linear-gradient(135deg,#818cf8,#a5b4fc)', fg: '#fff'},
        steady: {label: '平稳期', bg: '#ddd6fe', fg: '#5b21b6'},
        gather: {label: '蓄力期', bg: '#ede9fe', fg: '#7c3aed'},
        wrap: {label: '收束期', bg: '#c7d2fe', fg: '#3730a3'}
    };
    const track = cp.segments
        .map(sg => {
            const span = sg.end - sg.start + 1;
            const c = cfg[sg.phase];
            const w = ((span / 12) * 100).toFixed(1);
            return `<div class="${st.careerBarSeg}" style="width:${w}%;background:${c.bg};color:${c.fg}">${span >= 2 ? c.label : span === 1 && sg.phase === 'peak' ? '🔥' : ''}</div>`;
        })
        .join('');
    const monthLabels = Array.from({length: 12}, (_, i) => `<span>${i + 1}月</span>`).join('');
    return `<div class="${st.careerBarWrap}"><div class="${st.careerBarTrack}">${track}</div><div class="${st.careerBarMonths}">${monthLabels}</div></div>`;
}

/* ══════ Love Heatmap HTML ══════ */
export function buildLoveHeatmapHtml(monthScores: MonthPt[], st: Record<string, string>): string {
    const lo = Math.min(...monthScores.map(d => d.score));
    const hi = Math.max(...monthScores.map(d => d.score));
    const rng = hi - lo || 1;
    const cells = monthScores
        .map(d => {
            const t = (d.score - lo) / rng;
            const bg = `rgba(242,53,141,${(0.08 + t * 0.55).toFixed(2)})`;
            const fg = t > 0.5 ? '#8c0e4a' : '#b8447a';
            return `<div class="${st.loveHmCell}" style="background:${bg};color:${fg}"><div class="${st.loveHmMonth}">${d.month}月</div><div class="${st.loveHmScore}">${d.score}</div></div>`;
        })
        .join('');
    return `<div class="${st.loveHeatmap}">${cells}</div>`;
}
