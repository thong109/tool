// Novel Writing Tool - Main JavaScript Logic

class NovelGenerator {
    constructor() {
        this.config = {};
        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', () => this.generateStory());
        document.getElementById('regenerateBtn').addEventListener('click', () => this.generateStory());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportStory());
        
        // AI toggle
        const useAICheckbox = document.getElementById('useAI');
        useAICheckbox.addEventListener('change', (e) => {
            const apiKeyGroup = document.getElementById('apiKeyGroup');
            const aiProviderGroup = document.getElementById('aiProviderGroup');
            const freeAIInfo = document.getElementById('freeAIInfo');
            apiKeyGroup.style.display = e.target.checked ? 'block' : 'none';
            aiProviderGroup.style.display = e.target.checked ? 'block' : 'none';
            
            // Show free AI info if Hugging Face is selected
            const provider = document.getElementById('aiProvider').value;
            freeAIInfo.style.display = (e.target.checked && provider === 'huggingface') ? 'block' : 'none';
        });

        // Show/hide free AI info when provider changes
        const aiProviderSelect = document.getElementById('aiProvider');
        aiProviderSelect.addEventListener('change', (e) => {
            const freeAIInfo = document.getElementById('freeAIInfo');
            const useAI = document.getElementById('useAI').checked;
            freeAIInfo.style.display = (useAI && e.target.value === 'huggingface') ? 'block' : 'none';
        });

        // Load saved API key
        const savedApiKey = localStorage.getItem('novelAI_apiKey');
        if (savedApiKey) {
            document.getElementById('apiKey').value = savedApiKey;
        }

        // Save API key on change
        document.getElementById('apiKey').addEventListener('change', (e) => {
            localStorage.setItem('novelAI_apiKey', e.target.value);
        });
    }

    getConfig() {
        return {
            genre: document.getElementById('genre').value,
            setting: document.getElementById('setting').value,
            characterCount: parseInt(document.getElementById('characterCount').value) || 3,
            storyLength: document.getElementById('storyLength').value,
            narrativeStyle: document.getElementById('narrativeStyle').value,
            tone: document.getElementById('tone').value,
            customPrompt: document.getElementById('customPrompt').value.trim()
        };
    }

    generateStory() {
        this.config = this.getConfig();
        
        // Validate
        if (!this.config.genre) {
            alert('Vui lòng chọn thể loại truyện!');
            return;
        }

        // Show loading state
        const btn = document.getElementById('generateBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="loading"></span> Đang tạo...';
        btn.disabled = true;

        // Check if AI is enabled
        const useAI = document.getElementById('useAI').checked;
        const apiKey = document.getElementById('apiKey').value.trim();
        const aiProvider = document.getElementById('aiProvider').value;

        if (useAI && apiKey) {
            // Generate with AI
            this.generateWithAI(apiKey, aiProvider).then(story => {
                this.displayStory(story);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }).catch(error => {
                alert('Lỗi khi gọi AI: ' + error.message + '\nSử dụng chế độ thường...');
                this.createStory().then(story => {
                    this.displayStory(story);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                });
            });
        } else {
            // Simulate generation delay
            setTimeout(() => {
                const story = this.createStory();
                this.displayStory(story);
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1500);
        }
    }

    async generateWithAI(apiKey, provider) {
        const genreData = this.getGenreData(this.config.genre);
        const characters = this.generateCharacters(genreData);
        
        const prompt = this.buildAIPrompt(genreData, characters);
        
        let aiContent = '';
        
        if (provider === 'openai') {
            aiContent = await this.callOpenAI(apiKey, prompt);
        } else if (provider === 'claude') {
            aiContent = await this.callClaude(apiKey, prompt);
        } else if (provider === 'gemini') {
            aiContent = await this.callGemini(apiKey, prompt);
        } else if (provider === 'huggingface') {
            aiContent = await this.callHuggingFace(apiKey, prompt);
        }
        
        return this.parseAIResponse(aiContent, characters, genreData);
    }

    async callHuggingFace(apiKey, prompt) {
        // Using a free text generation model on Hugging Face
        const response = await fetch('https://api-inference.huggingface.co/models/gpt2-xl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 1000,
                    temperature: 0.8,
                    top_p: 0.95,
                    do_sample: true
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Hugging Face API error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorMessage;
            } catch (e) {
                // Use default error message
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Handle different response formats
        if (Array.isArray(data) && data[0] && data[0].generated_text) {
            return data[0].generated_text;
        } else if (data.generated_text) {
            return data.generated_text;
        } else {
            throw new Error('Unexpected response format from Hugging Face');
        }
    }

    buildAIPrompt(genreData, characters) {
        const charNames = characters.map(c => c.name).join(', ');
        return `Bạn là một nhà văn chuyên nghiệp. Hãy viết một câu chuyện ${genreData.name.toLowerCase()} với các yêu cầu sau:

Thể loại: ${genreData.name}
Bối cảnh: ${this.config.setting}
Số nhân vật: ${this.config.characterCount}
Độ dài: ${this.config.storyLength}
Phong cách: ${this.config.narrativeStyle}
Tông màu: ${this.config.tone}

Nhân vật:
${characters.map((c, i) => `${i+1}. ${c.name} - ${c.role}: ${c.personality}, ${c.background}`).join('\n')}

Yêu cầu bổ sung: ${this.config.customPrompt || 'Không có'}

Hãy viết câu chuyện chi tiết, sinh động, có cảm xúc, chia thành các chương rõ ràng. Trả về kết quả theo định dạng JSON sau:
{
  "title": "Tên truyện",
  "tagline": "Tagline ngắn gọn",
  "logline": "Giới thiệu 1-2 câu",
  "chapters": [
    {
      "number": 1,
      "title": "Tên chương",
      "content": "Nội dung chi tiết chương (ít nhất 3 đoạn văn)"
    }
  ],
  "world": {
    "location": "Địa điểm",
    "atmosphere": "Bầu không khí",
    "culture": "Văn hóa",
    "special": "Điểm đặc biệt"
  }
}

Chỉ trả về JSON, không có text khác.`;
    }

    async callOpenAI(apiKey, prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Bạn là một nhà văn chuyên nghiệp, luôn trả về JSON hợp lệ.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callClaude(apiKey, prompt) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 4000,
                system: 'Bạn là một nhà văn chuyên nghiệp, luôn trả về JSON hợp lệ.',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    async callGemini(apiKey, prompt) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Bạn là một nhà văn chuyên nghiệp. Luôn trả về JSON hợp lệ.\n\n${prompt}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 4000
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    parseAIResponse(aiContent, characters, genreData) {
        try {
            // Extract JSON from response
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const aiData = JSON.parse(jsonMatch[0]);
            
            // Convert to our story format
            const plot = aiData.chapters.map((ch, index) => ({
                chapter: ch.number || index + 1,
                title: ch.title || `Chương ${index + 1}`,
                content: ch.content
            }));

            return {
                overview: {
                    title: aiData.title || 'Câu Chuyện',
                    tagline: aiData.tagline || '',
                    logline: aiData.logline || ''
                },
                characters: characters,
                plot: plot,
                world: aiData.world || this.generateWorldBuilding(),
                config: this.config
            };
        } catch (error) {
            console.error('Error parsing AI response:', error);
            // Fallback to regular generation
            return this.createStory();
        }
    }

    createStory() {
        const genreData = this.getGenreData(this.config.genre);
        const characters = this.generateCharacters(genreData);
        const plot = this.generatePlot(genreData, characters);
        const world = this.generateWorldBuilding();
        const overview = this.generateOverview(genreData, characters);

        return {
            overview,
            characters,
            plot,
            world,
            config: this.config
        };
    }

    getGenreData(genre) {
        const genres = {
            'tinh-cam': {
                name: 'Tình Cảm',
                themes: ['tình yêu', 'định mệnh', 'hy sinh', 'tha thứ', 'khoảng cách'],
                conflicts: ['gia đình phản đối', 'quá khứ đau thương', 'hiểu lầm', 'khoảng cách xã hội'],
                endings: ['happy', 'bittersweet', 'tragic']
            },
            'hanh-dong': {
                name: 'Hành Động',
                themes: ['phiêu lưu', 'chiến đấu', 'báo thù', 'bảo vệ', 'sức mạnh'],
                conflicts: ['kẻ thù', 'nhiệm vụ nguy hiểm', 'thời gian', 'phản bội'],
                endings: ['victory', 'sacrifice', 'escape']
            },
            'gia-tuong': {
                name: 'Giả Tưởng',
                themes: ['ma thuật', 'huyền bí', 'sức mạnh đặc biệt', 'vận mệnh', 'thế giới khác'],
                conflicts: ['lực lượng hắc ám', 'lời tiên tri', 'cuộc chiến tranh', 'năng lượng'],
                endings: ['epic', 'transformation', 'new-beginning']
            },
            'kinh-di': {
                name: 'Kinh Dị',
                themes: ['ma quỷ', 'ám ảnh', 'bí mật đen tối', 'sợ hãi', 'sinh tồn'],
                conflicts: ['thực thể siêu nhiên', 'quá khứ kinh hoàng', 'lời nguyền', 'địa điểm ám ảnh'],
                endings: ['survival', 'curse', 'madness']
            },
            'hai-huoc': {
                name: 'Hài Hước',
                themes: ['tình huống dở khóc dở cười', 'nhầm lẫn', 'tình bạn', 'hạnh phúc'],
                conflicts: ['hiểu lầm buồn cười', 'tình huống trớ trêu', 'cạnh tranh vô lý'],
                endings: ['happy', 'funny', 'heartwarming']
            },
            'trinh-tham': {
                name: 'Trinh Thám',
                themes: ['bí ẩn', 'điều tra', 'sự thật', 'công lý', 'lừa dối'],
                conflicts: ['vụ án khó giải', 'hung thủ tinh vi', 'manh mối giả', 'thời gian'],
                endings: ['reveal', 'justice', 'twist']
            },
            'co-trang': {
                name: 'Cổ Trang',
                themes: ['vinh hoa', 'quyền lực', 'tình yêu cấm đoán', 'thủ đoạn', 'danh dự'],
                conflicts: ['cung đình', 'thế lực chính trị', 'hôn nhân chính trị', 'thân phận'],
                endings: ['tragic', 'power', 'escape']
            },
            'tuong-lai': {
                name: 'Tương Lai',
                themes: ['công nghệ', 'nhân bản', 'trí tuệ nhân tạo', 'tương lai', 'tiến hóa'],
                conflicts: ['công nghệ mất kiểm soát', 'cuộc chiến loài người', 'đạo đức', 'sự sống nhân tạo'],
                endings: ['evolution', 'coexistence', 'warning']
            },
            'huyen-ao': {
                name: 'Huyền Ảo',
                themes: ['tu luyện', 'tiên giới', 'pháp bảo', 'đạo hạnh', 'trường sinh'],
                conflicts: ['ma đạo', 'thiên kiếp', 'tâm ma', 'đại kiếp nạn'],
                endings: ['ascension', 'enlightenment', 'legacy']
            },
            'lich-su': {
                name: 'Lịch Sử',
                themes: ['dân tộc', 'độc lập', 'anh hùng', 'chiến tranh', 'lịch sử'],
                conflicts: ['giặc ngoại xâm', 'nội loạn', 'thời cuộc', 'lựa chọn'],
                endings: ['victory', 'sacrifice', 'legacy']
            }
        };
        return genres[genre] || genres['tinh-cam'];
    }

    generateCharacters(genreData) {
        const count = this.config.characterCount;
        const characters = [];
        
        const firstNames = ['Minh', 'Hương', 'Tuấn', 'Linh', 'Đức', 'Mai', 'Hoàng', 'Thảo', 'Nam', 'Nga', 'Khang', 'Diễm', 'Phúc', 'Ngọc', 'Thành'];
        const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
        
        const roles = ['Nhân vật chính', 'Nhân vật phụ quan trọng', 'Đồng minh', 'Đối thủ', 'Người thầy', 'Người bạn', 'Kẻ thù', 'Người thân', 'Đồng nghiệp', 'Người lạ'];
        
        const personalities = [
            'Trầm tính, thông minh và có tư duy chiến lược',
            'Nhiệt huyết, hào sảng và trung thành',
            'Lạnh lùng, bí ẩn nhưng có trái tim ấm áp',
            'Hài hước, lạc quan và luôn nhìn về phía trước',
            'Mạnh mẽ, độc lập và không bao giờ bỏ cuộc',
            'Nhẹ nhàng, tinh tế và hiểu biết',
            'Quyết đoán, cứng rắn và có khát vọng lớn',
            'Trung thực, chính trực và luôn làm điều đúng đắn'
        ];

        const backgrounds = [
            'Xuất thân từ gia đình bình thường, phải tự lập từ sớm',
            'Lớn lên trong hoàn cảnh khó khăn, rèn luyện ý chí kiên cường',
            'Được giáo dục trong môi trường quý tộc, có tầm nhìn rộng',
            'Từng trải qua bi kịch, khiến họ trưởng thành sớm',
            'Là con út trong gia đình, được yêu thương và bảo vệ',
            'Từng là người bình thường cho đến khi sự kiện thay đổi cuộc đời',
            'Mang trong mình một bí mật lớn về nguồn gốc của mình',
            'Được nuôi dưỡng bởi người thầy tuyệt vời, học được nhiều điều quý giá'
        ];

        for (let i = 0; i < count; i++) {
            const role = roles[i] || 'Nhân vật phụ';
            characters.push({
                name: `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${firstNames[Math.floor(Math.random() * firstNames.length)]}`,
                role: role,
                age: Math.floor(Math.random() * 40) + 18,
                personality: personalities[Math.floor(Math.random() * personalities.length)],
                background: backgrounds[Math.floor(Math.random() * backgrounds.length)],
                motivation: this.generateMotivation(genreData),
                arc: this.generateCharacterArc(role)
            });
        }

        return characters;
    }

    generateMotivation(genreData) {
        const motivations = [
            'Tìm kiếm sự thật về quá khứ của mình',
            'Bảo vệ người thân yêu khỏi nguy hiểm',
            'Chứng minh giá trị bản thân trước mọi người',
            'Tìm kiếm công lý cho những điều bất công',
            'Đạt được ước mơ từ nhỏ',
            'Trả thù cho người đã khuất',
            'Tìm kiếm hạnh phúc thực sự',
            'Hoàn thành sứ mệnh được giao phó'
        ];
        return motivations[Math.floor(Math.random() * motivations.length)];
    }

    generateCharacterArc(role) {
        const arcs = {
            'Nhân vật chính': 'Trải qua nhiều thử thách, từ một người bình thường trở thành người có sức mạnh và trí tuệ phi thường',
            'Nhân vật phụ quan trọng': 'Từ người ủng hộ trở thành đồng minh đáng tin cậy, đóng vai trò quan trọng trong hành trình',
            'Đồng minh': 'Ban đầu có mâu thuẫn nhưng sau đó trở thành người bạn đáng tin cậy',
            'Đối thủ': 'Ban đầu là kẻ thù nhưng cuối cùng có thể thay đổi quan điểm hoặc bị thuyết phục',
            'Người thầy': 'Hướng dẫn nhân vật chính, hy sinh để họ trưởng thành',
            'Người bạn': 'Luôn ở bên cạnh, hỗ trợ và động viên trong những lúc khó khăn nhất',
            'Kẻ thù': 'Đại diện cho mặt tối, tạo ra xung đột và thử thách cho nhân vật chính',
            'Người thân': 'Là động lực và điểm tựa tinh thần của nhân vật chính'
        };
        return arcs[role] || 'Đóng góp quan trọng vào câu chuyện';
    }

    generatePlot(genreData, characters) {
        const chapters = this.getChapterCount();
        const plotPoints = [];
        
        // Opening - Chapter 1
        plotPoints.push({
            chapter: 1,
            title: 'Khởi Đầu',
            content: this.generateChapterContent(1, characters, genreData, 'opening')
        });

        // Rising Action - Chapters 2 to climax-1
        const risingChapters = Math.floor(chapters * 0.6);
        for (let i = 2; i <= risingChapters; i++) {
            plotPoints.push({
                chapter: i,
                title: `Chương ${i}`,
                content: this.generateChapterContent(i, characters, genreData, 'rising')
            });
        }

        // Climax
        const climaxChapter = Math.floor(chapters * 0.8);
        plotPoints.push({
            chapter: climaxChapter,
            title: 'Cao Trào',
            content: this.generateChapterContent(climaxChapter, characters, genreData, 'climax')
        });

        // Falling Action
        if (climaxChapter < chapters) {
            plotPoints.push({
                chapter: climaxChapter + 1,
                title: 'Hậu Quả',
                content: this.generateChapterContent(climaxChapter + 1, characters, genreData, 'falling')
            });
        }

        // Resolution
        plotPoints.push({
            chapter: chapters,
            title: 'Kết Thúc',
            content: this.generateChapterContent(chapters, characters, genreData, 'resolution')
        });

        return plotPoints;
    }

    getChapterCount() {
        const lengths = {
            'short': 3,
            'medium': 7,
            'long': 15,
            'epic': 25
        };
        return lengths[this.config.storyLength] || 7;
    }

    generateChapterContent(chapterNum, characters, genreData, type) {
        const char = characters[0];
        const char2 = characters[1] || characters[0];
        const setting = this.generateWorldBuilding();
        
        const contentGenerators = {
            'opening': () => this.generateOpeningChapter(char, genreData, setting),
            'rising': () => this.generateRisingChapter(chapterNum, char, char2, genreData, characters),
            'climax': () => this.generateClimaxChapter(char, char2, genreData, characters),
            'falling': () => this.generateFallingChapter(char, genreData),
            'resolution': () => this.generateResolutionChapter(char, genreData)
        };
        
        return contentGenerators[type]();
    }

    generateOpeningChapter(char, genreData, setting) {
        const openings = [
            `Buổi sáng đó, ${char.name} thức dậy như mọi ngày, không hề biết rằng cuộc đời mình sắp thay đổi mãi mãi. Ánh nắng đầu tiên xuyên qua ô cửa sổ, chiếu vào căn phòng nhỏ bé, mang theo một cảm giác bình yên đặc biệt. ${char.name} bước ra khỏi nhà, hít thở không khí trong lành của buổi sáng, hoàn toàn không ngờ rằng đây sẽ là ngày cuối cùng của cuộc sống bình thường.

Mọi thứ bắt đầu thay đổi khi ${char.name} phát hiện ra một điều kỳ lạ. ${char.background.toLowerCase()}, và điều đó khiến họ có một góc nhìn độc đáo về thế giới xung quanh. ${char.name} cảm thấy có điều gì đó không ổn, một linh cảm mơ hồ rằng điều gì đó quan trọng sắp xảy ra.

Và rồi nó đã đến. Một sự kiện bất ngờ xảy ra, thay đổi hoàn toàn cuộc đời của ${char.name}. Từ khoảnh khắc đó, mọi thứ không còn như trước nữa. ${char.name} nhận ra rằng mình phải đối mặt với thử thách lớn lao, một hành trình đầy khó khăn và nguy hiểm đang chờ đợi phía trước.`,

            `Ngày hôm đó đánh dấu sự khởi đầu của một câu chuyện mà ${char.name} sẽ không bao giờ quên. Mọi thứ diễn ra bình thường cho đến khi ${char.name} tình cờ khám phá ra một bí mật được che giấu bấy lâu. ${setting.location} - nơi mà ${char.name} đã sống cả đời - bỗng trở nên xa lạ và đầy bí ẩn.

${char.name} cảm thấy tim mình đập nhanh khi nhận ra sự thật. ${char.background.toLowerCase()}, điều đó cho họ sự can đảm để tiếp tục. Nhưng cũng chính vì vậy, họ không thể quay đầu lại. Hành trình đầy thử thách đã bắt đầu, và ${char.name} biết rằng mình phải đối mặt với số phận của chính mình.

Khi hoàng hôn buông xuống, ${char.name} đứng trước một quyết định quan trọng. Điều gì sẽ đến tiếp theo? Liệu họ có đủ mạnh mẽ để đối mặt với những gì đang chờ đợi phía trước không? Câu trả lời chỉ có thể tìm thấy khi bước tiếp trên con đường đã chọn.`
        ];
        return openings[Math.floor(Math.random() * openings.length)];
    }

    generateRisingChapter(chapterNum, char, char2, genreData, characters) {
        const risingContent = [
            `${char.name} dần dần làm quen với những thử thách mới. Mỗi ngày trôi qua là một bài học quý giá, giúp họ trưởng thành hơn. ${char2.name} xuất hiện như một điểm sáng trong hành trình đầy khó khăn này, mang theo những thông tin quan trọng có thể thay đổi mọi thứ.

"Tôi đã tìm kiếm sự thật này bấy lâu nay," ${char2.name} nói, ánh mắt đầy quyết tâm. ${char.name} lắng nghe, và nhận ra rằng mình không còn đơn độc nữa. Cùng nhau, họ bắt đầu khám phá những bí mật sâu kín nhất, những bí mật có thể phá vỡ cả thế giới này.

Nhưng không phải lúc nào cũng thuận lợi. ${char.name} phải đối mặt với những khó khăn không ngờ tới, những thử thách kiểm tra giới hạn của họ. Liệu họ có thể vượt qua tất cả để đạt được mục tiêu của mình không?`,

            `Thời gian trôi qua, và ${char.name} ngày càng hiểu rõ hơn về sứ mệnh của mình. ${char.background.toLowerCase()} đã chuẩn bị họ cho những điều sắp xảy ra. Nhưng thử thách lần này lớn hơn bao giờ hết - nó đòi hỏi không chỉ sức mạnh mà còn cả trí tuệ và lòng can đảm.

${char.name} đứng trước ngã rẽ, phải đưa ra quyết định sẽ định hình số phận của tất cả. "Đây không chỉ là về tôi nữa," họ nghĩ thầm. "Đây là về tất cả những người tôi yêu thương, về tương lai của thế giới này."

Và rồi, khi mọi hy vọng dường như đã tắt, một điều kỳ diệu xảy ra. ${char.name} phát hiện ra sức mạnh tiềm ẩn bên trong mình - một sức mạnh mà trước đây họ chưa từng biết đến. Đây có phải là điểm bước ngoặt của câu chuyện?`,

            `Bí mật dần được tiết lộ, và ${char.name} nhận ra rằng sự thật còn kinh hoàng hơn cả những gì họ từng tưởng tượng. ${char2.name} đã đúng - mọi thứ đều liên kết với nhau, và họ đang ở trung tâm của tất cả.

"Chúng ta phải hành động ngay bây giờ," ${char2.name} khẩn thiết nói. ${char.name} gật đầu, mặc dù trong lòng họ tràn ngập những cảm xúc phức tạp. Sợ hãi, lo lắng, nhưng cũng có cả quyết tâm và hy vọng.

Hành trình tiếp theo sẽ đưa họ đến những nơi chưa từng ai đặt chân đến, đối mặt với những thử thách chưa từng có. Nhưng ${char.name} đã sẵn sàng. Vì họ biết rằng đây không chỉ là về bản thân mình - đây là về tất cả những điều họ tin tưởng và bảo vệ.`
        ];
        return risingContent[Math.floor(Math.random() * risingContent.length)];
    }

    generateClimaxChapter(char, char2, genreData, characters) {
        const climaxContent = [
            `Đây là khoảnh khắc ${char.name} đã chuẩn bị từ lâu. Tất cả những gì đã học được, tất cả những thử thách đã vượt qua, tất cả đều dẫn đến thời điểm này. ${char.name} đứng trước thử thách lớn nhất cuộc đời - thử thách sẽ quyết định số phận của tất cả.

"Tôi đã đến đây vì một lý do," ${char.name} nói, giọng đầy quyết tâm. "Và tôi sẽ không bỏ cuộc dù có điều gì xảy ra."

Xung quanh họ, thế giới dường như đứng yên. Mọi thứ phụ thuộc vào quyết định và hành động của ${char.name} ngay lúc này. Đây là lúc để chứng minh tất cả những gì họ đã trở thành.

Và rồi, với tất cả sức mạnh và can đảm, ${char.name} bước tới. Không còn do dự, không còn sợ hãi. Chỉ có quyết tâm mãnh liệt để hoàn thành sứ mệnh của mình.`,

            `Mọi thứ đã dẫn đến khoảnh khắc này. ${char.name} nhìn thấy sự thật cuối cùng - sự thật về danh tính, về nguồn gốc, về số phận của mình. Tất cả những mảnh ghép đã khớp lại, tạo nên bức tranh hoàn chỉnh mà trước đây họ chưa từng có thể tưởng tượng được.

"Tôi hiểu rồi," ${char.name} thì thầm, mắt ngân ngấn lệ. "Tất cả đều có ý nghĩa."

${char2.name} đứng bên cạnh, hỗ trợ và động viên. "Bạn không đơn độc. Chúng tôi ở đây với bạn."

Đây là lúc ${char.name} phải đưa ra lựa chọn cuối cùng - lựa chọn sẽ định hình tương lai của tất cả. Và họ biết rằng, bất kể điều gì xảy ra, họ phải đối mặt với nó với tất cả lòng can đảm của mình.`
        ];
        return climaxContent[Math.floor(Math.random() * climaxContent.length)];
    }

    generateFallingChapter(char, genreData) {
        const fallingContent = [
            `Sau cao trào, mọi thứ dần trở lại bình thường, nhưng không còn như trước nữa. ${char.name} nhìn lại hành trình đã qua, cảm thấy lòng mình tràn ngập những cảm xúc phức tạp. Có sự mất mát, có nỗi buồn, nhưng cũng có cả niềm vui và sự mãn nguyện.

Những người đã ở bên cạnh ${char.name} trong suốt hành trình giờ đây cũng đang đối mặt với hậu quả của những gì đã xảy ra. Mỗi người có cách riêng để đối mặt, nhưng tất cả đều hiểu rằng thế giới đã thay đổi mãi mãi.

${char.name} nhận ra rằng hành trình thực sự chưa kết thúc - nó chỉ mới bắt đầu. Những bài học đã học được, những trải nghiệm đã trải qua, tất cả đều trở thành phần quan trọng của cuộc đời họ. Từ giờ trở đi, ${char.name} sẽ bước đi trên con đường mới, với sự mạnh mẽ và khôn ngoan hơn bao giờ hết.`,

            `Hậu quả của cao trào dần được giải quyết. ${char.name} và những người bạn đã cùng nhau vượt qua thử thách lớn nhất, nhưng cũng phải trả giá không nhỏ. Có những mất mát không thể bù đắp, những điều không thể quên.

Nhưng trong đau thương, cũng có hy vọng. ${char.name} nhận ra rằng từ những khó khăn, họ đã trở nên mạnh mẽ hơn, sâu sắc hơn. Những mối quan hệ được củng cố, những giá trị được khẳng định.

Thế giới xung quanh đang chuyển mình sang một chương mới, và ${char.name} biết rằng mình sẽ là một phần quan trọng của chương mới đó. Họ đã thay đổi, và thế giới cũng vậy. Điều quan trọng là họ đã sẵn sàng cho những gì tiếp theo.`
        ];
        return fallingContent[Math.floor(Math.random() * fallingContent.length)];
    }

    generateResolutionChapter(char, genreData) {
        const endings = {
            'happy': `${char.name} đã đạt được mục tiêu của mình, và hạnh phúc thực sự đang chờ đợi phía trước. Mọi người đều có kết thúc tốt đẹp, những tổn thất được bù đắp, và những hy vọng được thực hiện. Câu chuyện kết thúc với nụ cười trên môi, nhưng cũng để lại những bài học quý giá về cuộc sống và tình yêu thương.

Nhìn lại hành trình đã qua, ${char.name} cảm thấy biết ơn vì tất cả những gì đã xảy ra. Những thử thách đã làm họ trưởng thành, những mất mát đã dạy họ trân trọng hơn, và những tình cảm đã cho họ thấy ý nghĩa thực sự của cuộc sống. Từ giờ, ${char.name} sẽ bước tiếp với trái tim đầy ắp tình yêu và hy vọng, sẵn sàng đối mặt với mọi thử thách mới.`,

            'bittersweet': `${char.name} đã đạt được mục tiêu, nhưng không phải không trả giá. Có những mất mát không thể nào quên, những điều đã mất đi mãi mãi. Nhưng chính trong những nỗi đau đó, ${char.name} đã tìm thấy sức mạnh thực sự bên trong mình.

Câu chuyện kết thúc với sự trưởng thành và sự tha thứ. ${char.name} hiểu rằng cuộc sống không phải lúc nào cũng công bằng, nhưng điều quan trọng là cách chúng ta đối mặt với nó. Và với tất cả những bài học đã học được, ${char.name} sẵn sàng bước vào chương mới của cuộc đời, mang theo cả nỗi buồn và niềm vui, cả mất mát và tìm được.`,

            'victory': `${char.name} đã chiến thắng! Sau tất cả những khó khăn, thử thách, và cả những lúc tuyệt vọng, họ cuối cùng cũng đã đạt được điều mình mong muốn. Chiến thắng này không chỉ thuộc về ${char.name}, mà còn thuộc về tất cả những người đã ủng hộ và tin tưởng họ.

${char.name} trở thành biểu tượng của hy vọng, một minh chứng cho sức mạnh của ý chí và lòng can đảm. Câu chuyện của họ sẽ được kể lại qua nhiều thế hệ, truyền cảm hứng cho những người khác theo đuổi ước mơ của mình. Đây không chỉ là kết thúc - đây là sự khởi đầu của một huyền thoại.`,

            'sacrifice': `${char.name} đã hy sinh tất cả vì điều họ tin tưởng. Sự hy sinh của họ không bị lãng quên - nó trở thành ánh sáng dẫn đường cho những người khác. Trong khoảnh khắc cuối cùng, ${char.name} không hối hận, vì họ biết rằng điều mình làm là đúng đắn.

Câu chuyện kết thúc với sự tiếc nuối, nhưng cũng đầy tự hào. ${char.name} đã cho thấy ý nghĩa thực sự của sự hy sinh - không phải là sự kết thúc, mà là sự bắt đầu của điều gì đó lớn lao hơn. Họ sống mãi trong trái tim của những người họ đã bảo vệ, và hành động của họ sẽ thay đổi thế giới mãi mãi.`,

            'new-beginning': 'Một chương mới bắt đầu, đầy hứa hẹn và cơ hội. Sau tất cả những gì đã xảy ra, thế giới đã thay đổi, và mọi người đều sẵn sàng bước vào tương lai mới. Những tổn thất được chữa lành, những hiểu lầm được giải quyết, và tất cả đều hướng về phía trước với hy vọng.\n\n' + `${char.name} đứng trên ngưỡng cửa của cuộc đời mới, nhìn về phía chân trời đầy nắng. Họ biết rằng hành trình chưa kết thúc - nó chỉ mới bắt đầu. Và lần này, họ không còn đơn độc nữa. Có những người bạn bên cạnh, những bài học đã học, và một trái tim đầy can đảm để đối mặt với bất kỳ điều gì sắp xảy ra.`
        };
        
        const endingType = genreData.endings[Math.floor(Math.random() * genreData.endings.length)];
        return endings[endingType] || endings['happy'];
    }

    getChapterTitle(chapter, genreData) {
        const titles = [
            'Thử Thách Đầu Tiên',
            'Bí Mật Được Tiết Lộ',
            'Đồng Minh Mới',
            'Nguy Hiểm Trong Ẩn',
            'Quyết Định Khó Khăn',
            'Hậu Quả',
            'Bước Ngoặt',
            'Sự Thật Bất Ngờ',
            'Chiến Đấu Vì Niềm Tin',
            'Khoảnh Khắc Quyết Định'
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    }

    generateWorldBuilding() {
        const settings = {
            'hien-dai': {
                location: 'Một thành phố hiện đại với sự kết hợp giữa truyền thống và hiện đại',
                atmosphere: 'Nhịp sống sôi động, công nghệ phát triển, nhưng vẫn giữ những giá trị truyền thống',
                culture: 'Văn hóa đa dạng, kết hợp giữa phương Đông và phương Tây',
                special: 'Có những địa điểm bí mật chỉ người trong giới mới biết'
            },
            'co-trang': {
                location: 'Một vùng đất cổ xưa với cung điện nguy nga và phong cảnh thiên nhiên hùng vĩ',
                atmosphere: 'Bầu không khí hoàng cung đầy quyền lực và thủ đoạn, nhưng cũng có những khoảnh khắc bình yên',
                culture: 'Nghi lễ trang trọng, hệ thống cấp bậc rõ ràng, đạo đức Nho giáo chi phối',
                special: 'Tồn tại những bí mật cổ xưa và nghệ thuật bị lãng quên'
            },
            'tuong-lai': {
                location: 'Thành phố tương lai với công nghệ tiên tiến và kiến trúc độc đáo',
                atmosphere: 'Thế giới của AI, du hành không gian, và những tiến bộ khoa học',
                culture: 'Xã hội hiện đại với những giá trị mới, nhưng vẫn còn vấn đề đạo đức cần giải quyết',
                special: 'Công nghệ đã thay đổi cách con người sống, nhưng cũng mang lại những thách thức mới'
            },
            'trung-co': {
                location: 'Vùng đất trung cổ với lâu đài, làng mạc và rừng rậm huyền bí',
                atmosphere: 'Thời kỳ của hiệp sĩ, phép thuật, và những cuộc thám hiểm mạo hiểm',
                culture: 'Hệ thống phong kiến, hiệp sĩ luật lệ, và những truyền thuyết cổ xưa',
                special: 'Tồn tại những loài sinh vật thần thoại và những bí mật cổ xưa'
            },
            'thoai-hoa': {
                location: 'Thế giới nguyên thủy với thiên nhiên hoang dã và các bộ lạc',
                atmosphere: 'Thời đại của sự sinh tồn, khám phá và xây dựng nền văn minh',
                culture: 'Các bộ lạc với phong tục tập quán đặc sắc, tôn thờ tự nhiên',
                special: 'Con người học cách sống hài hòa với thiên nhiên và khám phá bí mật vũ trụ'
            },
            'giao-tranh': {
                location: 'Thế giới song song với hai thực tại tồn tại song song',
                atmosphere: 'Sự cân bằng mong manh giữa hai thế giới, có thể bị phá vỡ bất cứ lúc nào',
                culture: 'Hai nền văn minh khác biệt nhưng có liên kết sâu sắc với nhau',
                special: 'Có những người có khả năng di chuyển giữa hai thế giới'
            }
        };

        const setting = settings[this.config.setting] || settings['hien-dai'];
        return setting;
    }

    generateOverview(genreData, characters) {
        const storyNames = this.generateStoryName(genreData);
        return {
            title: storyNames.title,
            tagline: storyNames.tagline,
            logline: `${characters[0].name}, ${characters[0].background.toLowerCase()}, phải đối mặt với ${genreData.themes[0]} và ${genreData.themes[1]}. Câu chuyện khám phá ${genreData.themes[2]} và ${genreData.themes[3]} thông qua hành trình đầy thử thách của nhân vật chính.`
        };
    }

    generateStoryName(genreData) {
        const titles = {
            'tinh-cam': ['Ánh Trăng Và Mặt Trời', 'Tình Yêu Giữa Mùa Đông', 'Định Mệnh Gặp Gỡ', 'Nơi Tình Yêu Bắt Đầu'],
            'hanh-dong': ['Hành Trình Vô Cực', 'Chiến Binh Cuối Cùng', 'Nhiệm Vụ Tử Thần', 'Báo Thù'],
            'gia-tuong': ['Vương Quốc Phép Thuật', 'Huyền Thoại Thời Đại', 'Ma Thuật Và Kiếm', 'Thế Giới Song Song'],
            'kinh-di': ['Đêm Kinh Hoàng', 'Lời Nguyền', 'Bóng Ma Trong Nhà', 'Ác Quỷ Trỗi Dậy'],
            'hai-huoc': ['Chuyện Tình Dở Khóc Dở Cười', 'Nhầm Lẫn Đáng Yêu', 'Tình Yêu Và Những Trớ Trêu', 'Hạnh Phúc Bất Ngờ'],
            'trinh-tham': ['Bí Mật Được Chôn Giấu', 'Vụ Án Không Lời Giải', 'Kẻ Giấu Mặt', 'Sự Thật Cuối Cùng'],
            'co-trang': ['Hoa Mưa Trong Cung', 'Mưa Rừng Phủ Phố', 'Tình Yêu Cấm Đoán', 'Vinh Quang Và Đau Thương'],
            'tuong-lai': ['Thế Giới Ngày Mai', 'Trí Tuệ Nhân Tạo', 'Tương Lai Của Loài Người', 'Công Nghệ Định Mệnh'],
            'huyen-ao': ['Tiên Giới Truyền Thuyết', 'Đạo Hạnh Và Ma Đạo', 'Tu Luyện Giới', 'Trường Sinh Lộ'],
            'lich-su': ['Huyền Thoại Dân Tộc', 'Chiến Tranh Và Hòa Bình', 'Người Hùng Thời Đại', 'Lịch Sử Viết Bằng Máu']
        };

        const titleList = titles[this.config.genre] || titles['tinh-cam'];
        const title = titleList[Math.floor(Math.random() * titleList.length)];
        
        const taglines = [
            'Khi định mệnh gọi tên, không ai có thể trốn chạy',
            'Tình yêu có thể vượt qua mọi thử thách',
            'Hành trình khám phá bản thân bắt đầu từ những điều nhỏ nhất',
            'Sự thật luôn được che giấu, nhưng không bao giờ bị lãng quên',
            'Khi mọi thứ sụp đổ, chỉ có tình yêu mới có thể xây dựng lại'
        ];

        return {
            title: title,
            tagline: taglines[Math.floor(Math.random() * taglines.length)]
        };
    }

    displayStory(story) {
        // Display overview
        const overviewDiv = document.getElementById('storyOverview');
        overviewDiv.innerHTML = `
            <h4 class="highlight">${story.overview.title}</h4>
            <p><em>"${story.overview.tagline}"</em></p>
            <p><strong>Giới thiệu:</strong> ${story.overview.logline}</p>
        `;

        // Display characters
        const charactersDiv = document.getElementById('characters');
        charactersDiv.innerHTML = '<ul>' + story.characters.map(char => `
            <li>
                <strong>${char.name} - ${char.role}</strong>
                <p><strong>Tuổi:</strong> ${char.age}</p>
                <p><strong>Tính cách:</strong> ${char.personality}</p>
                <p><strong>Nền tảng:</strong> ${char.background}</p>
                <p><strong>Động lực:</strong> ${char.motivation}</p>
                <p><strong>Diễn biến nhân vật:</strong> ${char.arc}</p>
            </li>
        `).join('') + '</ul>';

        // Display plot
        const plotDiv = document.getElementById('plotOutline');
        plotDiv.innerHTML = story.plot.map(point => `
            <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface); border-radius: 8px; border-left: 3px solid var(--secondary-color);">
                <strong>Chương ${point.chapter}: ${point.title}</strong>
                <p>${point.content}</p>
            </div>
        `).join('');

        // Display world building
        const worldDiv = document.getElementById('worldBuilding');
        worldDiv.innerHTML = `
            <p><strong>Địa điểm:</strong> ${story.world.location}</p>
            <p><strong>Bầu không khí:</strong> ${story.world.atmosphere}</p>
            <p><strong>Văn hóa:</strong> ${story.world.culture}</p>
            <p><strong>Điểm đặc biệt:</strong> ${story.world.special}</p>
        `;

        // Show result section
        document.getElementById('resultSection').style.display = 'block';
        
        // Scroll to results
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
    }

    exportStory() {
        const story = {
            overview: document.getElementById('storyOverview').innerText,
            characters: document.getElementById('characters').innerText,
            plot: document.getElementById('plotOutline').innerText,
            world: document.getElementById('worldBuilding').innerText
        };

        const content = `
${story.overview}

${story.characters}

${story.plot}

${story.world}

---
Tạo bởi Công Cụ Viết Truyện Tiểu Thuyết
        `.trim();

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'truyen-tieu-thuyet.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new NovelGenerator();
});