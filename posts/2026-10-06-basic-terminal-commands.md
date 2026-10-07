---
title: 꼭 알아야 할 기초 터미널 명령어
date: 2026-10-06
description: cd, mkdir, ls처럼 코딩을 시작할 때 가장 먼저 만나는 터미널 명령어를 간단히 정리했습니다.
tags: [TIL, 터미널]
---

블로그를 만들면서 터미널에 명령어를 입력할 일이 많았습니다. 처음엔 검은 화면이 낯설었지만, 자주 쓰는 명령어는 생각보다 몇 개 되지 않습니다.

> 터미널은 **글자로 컴퓨터에게 일을 시키는 창**입니다. 마우스로 폴더를 열고 파일을 만드는 일을 명령어로 대신한다고 생각하면 쉽습니다.

## 지금 어디에 있지? — `pwd`

**p**rint **w**orking **d**irectory의 줄임말로, 지금 내가 있는 폴더의 경로를 보여 줍니다.

```bash
pwd
# /c/Users/me/Desktop/my-blog
```

## 폴더 안에 뭐가 있지? — `ls`

현재 폴더의 파일과 폴더 목록을 보여 줍니다. `-a`를 붙이면 `.claude`처럼 이름이 점(`.`)으로 시작하는 숨김 항목도 보입니다.

```bash
ls
ls -a
```

## 폴더 이동하기 — `cd`

**c**hange **d**irectory, 다른 폴더로 이동합니다.

```bash
cd posts      # posts 폴더 안으로 들어가기
cd ..         # 한 단계 위 폴더로 나가기
cd ~          # 내 홈 폴더로 가기
```

- `.`은 **현재 폴더**, `..`은 **상위 폴더**를 뜻합니다.
- 경로에 띄어쓰기나 한글이 있으면 따옴표로 감싸는 것이 안전합니다: `cd "내 문서"`

## 폴더 만들기 — `mkdir`

**m**a**k**e **dir**ectory, 새 폴더를 만듭니다. `-p`를 붙이면 중간 폴더까지 한 번에 만듭니다.

```bash
mkdir assets
mkdir -p assets/images/2026
```

## 파일 만들기와 내용 보기 — `touch`, `cat`

```bash
touch notes.md        # 빈 파일 만들기
cat posts/posts.json  # 파일 내용 출력하기
```

## 복사, 이동, 삭제 — `cp`, `mv`, `rm`

```bash
cp a.md b.md          # a.md를 b.md로 복사
mv b.md posts/        # b.md를 posts 폴더로 이동
mv old.md new.md      # 이름 바꾸기도 mv로 한다
rm new.md             # 파일 삭제
rm -r old-folder      # 폴더째 삭제
```

`rm`으로 지운 파일은 **휴지통을 거치지 않고 바로 사라집니다.** 실행하기 전에 지울 대상을 꼭 다시 확인하세요.

## 한눈에 정리

| 명령어 | 뜻 | 하는 일 |
| --- | --- | --- |
| `pwd` | print working directory | 현재 위치 확인 |
| `ls` | list | 목록 보기 |
| `cd` | change directory | 폴더 이동 |
| `mkdir` | make directory | 폴더 만들기 |
| `touch` | — | 빈 파일 만들기 |
| `cat` | concatenate | 파일 내용 보기 |
| `cp` | copy | 복사 |
| `mv` | move | 이동·이름 바꾸기 |
| `rm` | remove | 삭제 |

## 윈도우 PowerShell에서는?

윈도우의 PowerShell에서도 `cd`, `ls`, `mkdir`, `cat`, `cp`, `mv`, `rm`은 비슷하게 동작합니다. 다만 옵션 모양이 다릅니다.

| bash | PowerShell |
| --- | --- |
| `ls -a` | `ls -Force` |
| `mkdir -p a/b` | `mkdir a/b` (중간 폴더도 자동으로 만듦) |
| `touch notes.md` | `New-Item notes.md` |
| `rm -r 폴더` | `Remove-Item -Recurse 폴더` |

## 작은 팁

- **Tab 키**를 누르면 파일·폴더 이름이 자동 완성됩니다. 오타가 확 줄어듭니다.
- **위쪽 화살표(↑)** 를 누르면 방금 입력한 명령어를 다시 불러옵니다.
- 실행 중인 명령을 멈추고 싶을 때는 **Ctrl + C**를 누릅니다. 로컬 서버(`python -m http.server`)를 끌 때도 이렇게 합니다.

이 몇 가지만 익숙해져도 프로젝트 폴더를 오가며 작업하는 일이 훨씬 편해집니다.
