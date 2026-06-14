from search.anakin import AnakinAgent

anakin=AnakinAgent()

urls=["https://www.reddit.com/r/developersIndia/comments/1fvw42s/interview_preparatory_material_for_cracking_google/",
      "https://www.reddit.com/r/leetcode/comments/1n0l8gg/my_long_google_interview_experience/",
      "https://www.reddit.com/r/leetcode/comments/1irqkfi/google_interview_experience/"]
result=anakin.scrape_urls(urls)
print(result)


